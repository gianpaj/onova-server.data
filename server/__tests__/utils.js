// @flow

import httpStatus from 'http-status';
import request from 'supertest';
import path from 'path';

import { UserDoc } from '../models/user.model';
import { CommentDoc, ProductDoc } from '../models/product.model';
import Verification from '../models/verification.model';
import app from '../index';

// GET /api/users/ should only return these fields
const userFields = [
  '_id',
  'accountStatus',
  'emailAddress',
  'followersCount',
  'followingCount',
  'username',
];

// POST /api/auth/login should only return these fields
const authFields = ['data', 'token'];

/**
 * Create a user and activate it
 */
export function createUserAndLogin(
  user: UserDoc
): Promise<{ user: UserDoc, jwtToken: string }> {
  return request(app)
    .post('/api/users')
    .send(user)
    .expect(httpStatus.CREATED)
    .then(res => {
      if (!res.body.data) {
        console.error(res.body);
        throw new Error(res.body);
      }
      const resUser = res.body.data;
      expect(typeof resUser._id).toBe('string');
      expect(resUser.username).toBe(user.username);
      expect(resUser.emailAddress).toBe(user.emailAddress);
      expect(resUser.accountStatus).toBe('notverified');
      expect(resUser.followersCount).toBe(0);
      expect(resUser.followingCount).toBe(0);
      expect(typeof res.body.token).toBe('string');
      expect(Object.keys(resUser).sort()).toEqual(userFields.sort());

      return res.body.data;
    })
    .then((resUser: UserDoc) => {
      // flow-disable-next-line
      return Verification.findOne({ user: resUser._id }).then(verDoc => {
        if (!verDoc) {
          throw Error('no verification token found');
        }
        return { resetToken: verDoc.resetToken, resUser };
      });
    })
    .then(({ resetToken, resUser }) => {
      return request(app)
        .get(`/api/auth/activate/${resetToken}`)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.text).toContain('Account activated');
          return resUser;
        });
    })
    .then((resUser: UserDoc) => {
      return request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: resUser.emailAddress,
          password: user.password,
        })
        .expect(httpStatus.OK)
        .then(res => {
          expect(Object.keys(res.body).sort()).toEqual(authFields.sort());
          return { user: resUser, jwtToken: res.body.token };
        });
    })
    .catch(e => e);
}

/**
 * Create a product with one image
 *
 * @param {ProductDoc} product
 * @param {string} jwToken
 * @return {Promise<ProductDoc>}
 */
export function createProduct(
  product: ProductDoc,
  jwToken: string
): Promise<ProductDoc> {
  return request(app)
    .post('/api/products')
    .set('Authorization', jwToken)
    .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
    .field(product)
    .expect(httpStatus.CREATED)
    .then(res => {
      if (!res.body.data) console.error(res.body);
      expect(typeof res.body.data).toBe('object');
      return res.body.data;
    });
}

/**
 * Create a comment on a product
 *
 * @param {CommentDoc} comment
 * @param {string} productUuid
 * @param {string} jwToken
 * @return {Promise<CommentDoc>}
 */
export function createComment(
  comment: CommentDoc,
  productUuid: string,
  jwToken: string
): Promise<CommentDoc> {
  return request(app)
    .post(`/api/products/${productUuid}/comment`)
    .set('Authorization', jwToken)
    .send(comment)
    .expect(httpStatus.CREATED)
    .then(res => {
      expect(res.body.data.uuid).toBe(productUuid);
      return res.body.data;
    });
}

export function createManyComments(
  num: number,
  productUuid: string,
  jwtToken: string
) {
  const c = {
    text: 'nice pair of socks',
  };

  const Promises = [];
  for (let i = 0; i <= num; i++) {
    Promises.push(createComment(c, productUuid, jwtToken));
  }

  return Promise.all(Promises)
    .then(res => res)
    .catch(e => e);
}
