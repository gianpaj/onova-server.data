// @flow

import httpStatus from 'http-status';
import request from 'supertest';
import path from 'path';

import { UserDoc } from '../models/user.model';
import { CommentDoc, ProductDoc } from '../models/product.model';
import { OrderDoc } from '../models/order.model';
import Verification from '../models/verification.model';
import app from '../index';

// GET /api/users/ should only return these fields
export const userFields = [
  '_id',
  'accountStatus',
  'emailAddress',
  'followersCount',
  'followingCount',
  'ratingsTotal',
  'reviewsCount',
  'tokens',
  'username',
];

// GET & PUT /api/orders/ should only return these fields
export const orderFields = [
  'buyer',
  'currency',
  'datePending',
  'id',
  'onovaFee',
  'priceOfItem',
  'product',
  'seller',
  'status',
  'transactionStatus',
];

// POST /api/auth/login should only return these fields
const authFields = ['data', 'token'];

// should only return these fields
export const productFields = [
  '_id',
  'categoryIds',
  'createdAt',
  'currency',
  'description',
  'likes',
  'photoURIs',
  'price',
  'seller',
  'status',
  'tags',
  'typeIds',
  'updatedAt',
  'uuid',
];

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
    .then(({ body }) => {
      if (!body.data) {
        throw new Error(body);
      }
      expect(Object.keys(body.data).sort()).toEqual(userFields.sort());

      return { resUser: body.data, jwtToken: body.token };
    })
    .then(({ resUser, jwtToken }) => {
      // flow-disable-next-line
      return Verification.findOne({ user: resUser._id }).then(verDoc => {
        if (!verDoc) {
          throw Error('no verification token found');
        }
        return { resetToken: verDoc.resetToken, resUser, jwtToken };
      });
    })
    .then(({ resetToken, resUser, jwtToken }) => {
      return request(app)
        .get(`/api/auth/activate/${resetToken}`)
        .expect(httpStatus.OK)
        .then(({ text }) => {
          expect(text).toContain('Профіль активовано');
          return { user: resUser, jwtToken };
        });
    })
    .catch(e => {
      console.error(e);
      return e;
    });
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
  for (let i = 0; i < num; i++) {
    Promises.push(createComment(c, productUuid, jwtToken));
  }

  return Promise.all(Promises)
    .then(res => res)
    .catch(e => e);
}

/**
 * Order a product
 *
 * @param {ProductDoc} product
 * @param {string} jwtToken
 * @returns {Promise<OrderDoc>}
 */
export function createOrder(
  product: ProductDoc,
  jwtToken: string
): Promise<OrderDoc> {
  return request(app)
    .post('/api/orders')
    .set('Authorization', jwtToken)
    .send({ product: product.uuid })
    .expect(httpStatus.CREATED)
    .then(res => {
      const o = res.body.data;
      expect(o.status).toBe('pending');
      expect(o.priceOfItem).toBe(product.price);
      return o;
    });
}

export async function createManyProducts(num: number, jwtToken: string) {
  let p = {
    categoryIds: [2],
    typeIds: [1],
    tags: ['warm', 'bundle'],
    description: 'nice pair of socks',
  };

  const items = [];
  for (let i = 0; i <= num; i++) {
    // $FlowFixMe
    p.price = Math.floor(Math.random() * 50);
    items.push(p);
  }
  return await Promise.all(
    items.map(async item => {
      await createProduct(item, jwtToken);
    })
  )
    .then(res => res)
    .catch(e => e);
}
