// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';

import Follow from '../models/follow.model';
import Tag from '../models/tag.model';
import User from '../models/user.model';
import Product from '../models/product.model';
import Notification from '../models/notification.model';
import Verification from '../models/verification.model';
import {
  createComment,
  createManyComments,
  createProduct,
  createUserAndLogin,
} from './utils';

/**
 * root level hooks
 */
afterAll(done => {
  // required because https://github.com/Automattic/mongoose/issues/1251#issuecomment-65793092
  mongoose.models = {};
  mongoose.modelSchemas = {};
  mongoose.connection.close();
  done();
});

// GET /api/users/notifications - should only return these fields
const notifFields = [
  'dateCreated',
  '_id',
  'data',
  'notifI18n',
  'targetUser',
  'triggeredBy',
  'triggeredType',
];

let user = {
  username: 'firstperson',
  emailAddress: 'gianpa+test@gmail.com',
  mobileNumber: '1234567890', // optional
  password: 'expressos',
};

let anotherUser = {
  username: 'anotherperson',
  emailAddress: 'gianpa+test2@gmail.com',
  mobileNumber: '1234567890', // optional
  password: 'express2',
};

const product = {
  categoryIds: [1, 2, 3],
  typeIds: [1, 2, 3],
  tags: ['winter', 'spring2007'], // optional
  description: 'nice boots',
  // seller comes after the user is created
  price: '100.99', // if no decimal points .00 will be added
};

let anotherProduct = {
  categoryIds: [1],
  typeIds: [1, 3],
  description: 'nice jacket',
  price: '230.99',
};

let userId;
let anotherUserId;
let productUuid;
let productId;
let anotherProductId;
let anotherProductUuid;
let firstJwtToken;
let anotherJwtToken;

describe('## Notification APIs', () => {
  beforeAll(done => {
    const collections = [
      Follow.collection,
      Notification.collection,
      Product.collection,
      Tag.collection,
      User.collection,
      Verification.collection,
    ];

    var todo = collections.length;
    if (!todo) return done();

    collections.forEach(collection => {
      collection.remove({}, { safe: true }, () => {
        if (--todo === 0) done();
      });
    });
  });

  // create 2 users/sellers + 2 products
  beforeAll(done => {
    createUserAndLogin(user)
      .then(({ user, jwtToken }) => {
        userId = user._id;
        firstJwtToken = jwtToken;
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(() => {
        return createUserAndLogin(anotherUser).then(({ user, jwtToken }) => {
          anotherUserId = user._id;
          anotherJwtToken = jwtToken;
        });
      })
      .then(async () => {
        const p1 = await createProduct(product, firstJwtToken);
        expect(p1.description).toBe(product.description);
        productUuid = p1.uuid;
        productId = p1._id;
      })
      .then(async () => {
        const p2 = await createProduct(anotherProduct, anotherJwtToken);
        expect(p2.description).toBe(anotherProduct.description);
        anotherProductUuid = p2.uuid;
        anotherProductId = p2._id;
        done();
      });
  });

  describe('# GET /api/users/notifications', () => {
    // create comments
    beforeAll(async () => {
      const c2 = await createComment(
        { text: 'first!' },
        anotherProductUuid,
        firstJwtToken
      );
      expect(c2.uuid).toBe(anotherProductUuid);
      await createManyComments(40, productUuid, anotherJwtToken);
    });

    it('should get my notifications', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          // notifId = data[0]._id;
          expect(data[0].triggeredBy).toBe(productId);
          expect(data).toHaveLength(41);
        });
    });

    it('should not get my notifications without authorization', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', 'asdf')
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should get another person`s notifications', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(Object.keys(data[0]).sort()).toEqual(notifFields.sort());
          expect(data[0].triggeredBy).toBe(anotherProductId);
          expect(data).toHaveLength(1);
        });
    });
  });

  describe('# DELETE /api/products/:uuid/comment/:commentId', () => {
    let commentIdSecond;

    beforeAll(async () => {
      const data = await createComment(
        { text: 'love the boots' },
        productUuid,
        firstJwtToken
      );
      commentIdSecond = data.comment._id;

      return request(app)
        .delete(`/api/products/${productUuid}/comment/${commentIdSecond}`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data.uuid).toBe(productUuid);
          expect(data.length).toBe(41);
        });
    });

    it('should not get the deleted comment notification', done => {
      request(app)
        .get('/api/users/notifications')
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].triggeredBy).toBe(productId);
          expect(data).toHaveLength(41);
          done();
        });
    });
  });
});
