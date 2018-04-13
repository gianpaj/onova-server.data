// @flow

import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import Notification from '../models/notification.model';
import Order from '../models/order.model';
import Product from '../models/product.model';
import User from '../models/user.model';
import Verification from '../models/verification.model';
import Review from '../models/review.model';
import { createUserAndLogin, createProduct, orderFields } from './utils';

// GET & PUT /api/orders/ should only return these fields
const reviewFields = [
  '_id',
  'id',
  'order',
  'fromUser',
  'targetUser',
  'text',
  'rateNumber',
  'lang',
  'createdAt',
];

describe('## Order APIs', () => {
  beforeAll(done => {
    // mongoose.connection.dropDatabase().then(done);
    const collections = [
      Notification.collection,
      Order.collection,
      Product.collection,
      Review.collection,
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

  let userFirst = {
    username: 'userfirst',
    emailAddress: 'userfirst@gmail.com',
    mobileNumber: '1234567890', // optional
    password: 'expressos',
  };

  let userAnother = {
    username: 'useranother',
    emailAddress: 'useranother@gmail.com',
    mobileNumber: '1234567890', // optional
    password: 'express2',
    pushToken: 'userAnotherPushToken',
    platform: 'ios',
  };

  let nonActiveUser = {
    username: 'nonactiveuser',
    emailAddress: 'nonactiveuser@gmail.com',
    mobileNumber: '1234567890',
    password: 'expressos',
  };

  let userForth = {
    username: 'userforth',
    emailAddress: 'userforth@gmail.com',
    mobileNumber: '1234567890',
    password: 'expressos4',
  };

  let productBoots = {
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    tags: ['winter', 'spring2007'], // optional
    description: 'nice boots',
    // seller id is the user who creates the product
    price: '100.99', // if no decimal points .00 will be added
  };

  let productFlipflops = {
    categoryIds: [3],
    typeIds: [1, 3],
    tags: ['summer'],
    description: 'nice flipflops',
    price: '10.99',
  };

  let productShorts = {
    categoryIds: [2],
    typeIds: [2, 3],
    description: 'nice shorts',
    price: '200.50',
  };

  let productBootsUuid;
  let productFlipflopsUuid;
  let productShortsUuid;
  let userFirstJwtToken;
  let userAnotherJwtToken;
  let userNotActiveJwtToken;
  let userForthJwtToken;

  // create 3 users. 1 not activated
  beforeAll(done => {
    createUserAndLogin(userFirst)
      .then(({ user, jwtToken }) => {
        userFirst._id = user._id;
        userFirstJwtToken = jwtToken;
      })
      .then(() => {
        return createUserAndLogin(userAnother).then(({ user, jwtToken }) => {
          userAnother._id = user._id;
          userAnotherJwtToken = jwtToken;
        });
      })
      .then(() => {
        return createUserAndLogin(userForth).then(({ user, jwtToken }) => {
          userForth._id = user._id;
          userForthJwtToken = jwtToken;
        });
      })
      .then(() => {
        return request(app)
          .post('/api/users')
          .send(nonActiveUser)
          .expect(httpStatus.CREATED)
          .then(res => {
            const resUser = res.body.data;
            expect(typeof resUser._id).toBe('string');
            expect(resUser.username).toBe(nonActiveUser.username);
            expect(resUser.emailAddress).toBe(nonActiveUser.emailAddress);
            expect(resUser.accountStatus).toBe('notverified');
            expect(resUser).not.toHaveProperty('password');
            expect(typeof res.body.token).toBe('string');
            // flow-disable-next-line
            nonActiveUser._id = resUser._id;
          });
      })
      .then(() => {
        return request(app)
          .post('/api/auth/login')
          .send({
            emailAddress: nonActiveUser.emailAddress,
            password: nonActiveUser.password,
          })
          .expect(httpStatus.OK)
          .then(res => {
            expect(res.body).toHaveProperty('token');
            userNotActiveJwtToken = res.body.token;
            done();
          });
      });
  });

  // create 3 products and delete 1 of them
  beforeAll(async () => {
    await createProduct(productBoots, userFirstJwtToken).then(p => {
      productBootsUuid = p.uuid;
    });
    await createProduct(productShorts, userAnotherJwtToken).then(p => {
      productShortsUuid = p.uuid;
    });

    // create product and delete it
    const p = await createProduct(productFlipflops, userFirstJwtToken);

    productFlipflopsUuid = p.uuid;
    const res = await request(app)
      .delete(`/api/products/${productFlipflopsUuid}`)
      .set('Authorization', userFirstJwtToken)
      .expect(httpStatus.NO_CONTENT);
    expect(res.body).toMatchObject({});
  });

  describe('# POST /api/users/:userId/review', () => {
    let orderOne, orderTwo, orderThreePending;
    // userFirst buys an productShorts (seller is userAnother) and we set it as completed (manually)
    beforeAll(async () => {
      orderOne = await request(app)
        .post('/api/orders')
        .set('Authorization', userFirstJwtToken)
        .send({ product: productShortsUuid })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          expect(o.status).toBe('pending');
          expect(o.currency).toBe('UAH');
          expect(o.onovaFee).toBe((productShorts.price * 1).toString());
          expect(o.priceOfItem).toBe(productShorts.price);
          expect(o.transactionStatus).toBe('pl-pending');
          return o;
        });
      const o = await Order.updateOne(
        { _id: orderOne.id },
        { $set: { status: 'completed' } }
      );
      expect(o.nModified).toBe(1);

      orderTwo = await request(app)
        .post('/api/orders')
        .set('Authorization', userAnotherJwtToken)
        .send({ product: productBootsUuid })
        .expect(httpStatus.CREATED)
        .then(res => res.body.data);
      const o2 = await Order.updateOne(
        { _id: orderTwo.id },
        { $set: { status: 'completed' } }
      );
      expect(o2.nModified).toBe(1);

      orderThreePending = await request(app)
        .post('/api/orders')
        .set('Authorization', userForthJwtToken)
        .send({ product: productShortsUuid })
        .expect(httpStatus.CREATED)
        .then(res => res.body.data);
    });

    it('should create an review by the buyer', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great seller AAA+',
          rateNumber: 5,
          lang: 'en',
        })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order).toBe(orderOne.id);
          expect(o.fromUser).toBe(userFirst._id);
          expect(o.targetUser).toBe(userAnother._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should **not** create a duplicate review for that order (as buyer)', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great seller AAA+ dupe',
          rateNumber: 3,
          lang: 'en',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('Duplicate review');
        });
    });

    it('should create an review by the seller', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great buyer AAA+',
          rateNumber: 5,
          lang: 'en',
        })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order).toBe(orderOne.id);
          expect(o.fromUser).toBe(userAnother._id);
          expect(o.targetUser).toBe(userFirst._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should **not** create a duplicate review for that order (as seller)', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great buyer AAA+ dupe',
          rateNumber: 1,
          lang: 'en',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('Duplicate review');
        });
    });

    it('should **not** create a review with invalid rateNumber', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderTwo.id,
          text: 'great stuff',
          rateNumber: 9,
          lang: 'en',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('must be less than or equal to 5');
        });
    });

    it('should **not** create a review with invalid order', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: '5ad0d405091374a087a7ffff',
          text: 'great stuff',
          rateNumber: 5,
          lang: 'en',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Invalid order');
        });
    });

    it('should **not** create a review with invalid lang', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderTwo.id,
          text: 'great stuff',
          rateNumber: 5,
          lang: 'po',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('must be one of [uk, en]');
        });
    });

    it('should **not** create a review with invalid text', async () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderTwo.id,
          text: 'gr',
          rateNumber: 5,
          lang: 'en',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('must be at least 7 characters');
        });
    });

    it('should **not** create a review if the order is not completed (as buyer)', async () => {
      return request(app)
        .post(`/api/users/${userAnother._id}/reviews`)
        .set('Authorization', userForthJwtToken)
        .send({
          orderId: orderThreePending.id,
          text: 'greeeeeat',
          rateNumber: 5,
          lang: 'en',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain(
            `Cannot create review on an order that is 'pending'`
          );
        });
    });
  });

  // describe('# GET /api/users/:userId/review', () => {});
});
