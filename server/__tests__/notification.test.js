// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';

import Follow from '../models/follow.model';
import Tag from '../models/tag.model';
import User from '../models/user.model';
import Order from '../models/order.model';
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
let lastNotifId;

describe('## Notification APIs', () => {
  beforeAll(done => {
    const collections = [
      Follow.collection,
      Notification.collection,
      Order.collection,
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
      const c1 = await createComment(
        { text: 'first!' },
        anotherProductUuid,
        firstJwtToken
      );
      expect(c1.uuid).toBe(anotherProductUuid);
      const c2 = await createComment(
        { text: 'thanks dude!' },
        anotherProductUuid,
        anotherJwtToken
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
          expect(data[0].triggeredBy).toBe(productId);
          expect(data[0].notifI18n).toContain('new comment');
          expect(data).toHaveLength(41);
        });
    });

    it('should get my first 20 notifications', async () => {
      return request(app)
        .get('/api/users/notifications?limit=20')
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          lastNotifId = data[19]._id;
          expect(data[0].triggeredBy).toBe(productId);
          expect(data[0].notifI18n).toContain('new comment');
          expect(data).toHaveLength(20);
        });
    });

    it('should load more notifications', async () => {
      return request(app)
        .get(`/api/users/notifications?lastId=${lastNotifId}`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].triggeredBy).toBe(productId);
          expect(data).toHaveLength(20);
        });
    });

    it('should not load more notifications with a missing lastId', async () => {
      return request(app)
        .get(`/api/users/notifications?lastId=5ff8ef0e9147a8bd32ea35f6`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.NOT_FOUND)
        .then(res => {
          expect(res.body.message).toContain('Notification not found');
        });
    });

    it('should not get notifications without authorization', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', 'asdf')
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should not create a new notification when a comment is inserted by the seller', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(Object.keys(data[0]).sort()).toEqual(notifFields.sort());
          expect(data[0].triggeredBy).toBe(anotherProductId);
          expect(data[0].notifI18n).toContain('new comment');
          expect(data).toHaveLength(1);
        });
    });
  });

  describe('# DELETE /api/products/:uuid/comment/:commentId', () => {
    let commentIdSecond;

    beforeAll(async () => {
      const data = await createComment(
        { text: 'love the boots' },
        anotherProductUuid,
        firstJwtToken
      );
      commentIdSecond = data.comment._id;

      return request(app)
        .delete(
          `/api/products/${anotherProductUuid}/comment/${commentIdSecond}`
        )
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data.uuid).toBe(anotherProductUuid);
          expect(data.length).toBe(2);
        });
    });

    it('should not get the deleted comment notification', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].triggeredBy).toBe(anotherProductId);
          expect(data).toHaveLength(1);
        });
    });
  });

  describe('# Follow and Notify', () => {
    // firstUser --follows--> anotherUser
    beforeAll(async () => {
      return request(app)
        .post(`/api/users/${anotherUserId}/follow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.CREATED)
        .then(res => {
          const { data } = res.body;
          expect(data.follower).toBe(userId);
          expect(data.following).toBe(anotherUserId);
          expect(Object.keys(data).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
        });
    });

    it('should create a notification for the person being followed', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].triggeredBy).toBe(userId);
          expect(data[0].notifI18n).toContain('new follower');
          expect(data).toHaveLength(2);
        });
    });
  });

  describe('# Create an order and Notify', () => {
    let orderId;
    beforeAll(async () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', anotherJwtToken)
        .send({ product: productUuid })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          orderId = o.id;
          expect(o.status).toBe('pending');
          expect(o.currency).toBe('UAH');
          expect(o.onovaFee).toBe((product.price * 1).toString());
          expect(o.priceOfItem).toBe(product.price);
          expect(o.transactionStatus).toBe('pl-pending');
        });
    });

    it('a new order notification should have not have been created', async () => {
      return request(app)
        .get('/api/users/notifications')
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data).toHaveLength(41);
        });
    });

    describe('# Cancel an order and Notify the buyer', () => {
      beforeAll(async () => {
        return request(app)
          .put(`/api/orders/${orderId}`)
          .set('Authorization', firstJwtToken)
          .send({ status: 'cancelled' })
          .expect(httpStatus.OK)
          .then(res => {
            const o = res.body.data;
            expect(o.priceOfItem).toBe(product.price);
            expect(o.status).toBe('cancelled');
          });
      });

      it('a new order notification should have been created to the buyer', async () => {
        return request(app)
          .get('/api/users/notifications')
          .set('Authorization', anotherJwtToken)
          .expect(httpStatus.OK)
          .then(res => {
            const { data } = res.body;
            expect(data[0].triggeredBy).toBe(orderId);
            expect(data[0].notifI18n).toContain('cancelled');
            expect(data).toHaveLength(3);
          });
      });
    });
  });
});
