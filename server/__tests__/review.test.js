// @flow

import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import {
  Notification,
  Order,
  Product,
  Review,
  User,
  Verification,
} from '../models';
import {
  createUserAndLogin,
  createProduct,
  orderFields,
  createOrder,
  productFields,
  userFields,
} from './utils';

const moreUserFields = [
  ...userFields,
  'createdAt',
  'id',
  'mobileNumber',
  'platform',
  'pushToken',
  'updatedAt',
];

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
    pushToken: 'userfirstPushToken',
    platform: 'android',
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

  let reviewTwo = {
    text: 'great stuff',
    rateNumber: 5,
    lang: 'en',
    trackingNumber: '20450072617861',
  };

  let productBootsUuid;
  let productFlipflopsUuid;
  let productShortsUuid;
  let userFirstJwtToken;
  let userAnotherJwtToken;
  let userNotActiveJwtToken;
  let userForthJwtToken;
  let reviewsCountUserAnother = 0;
  let reviewsCountUserFirst = 0;
  let ratingsTotalUserFirst = 0;
  let ratingsTotalUserAnother = 0;

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
    let orderOne, orderTwo, orderThreePending, orderSix;
    // userFirst buys productShorts (from userAnother)
    beforeAll(async () => {
      orderOne = await createOrder(
        {
          uuid: productShortsUuid,
          price: productShorts.price,
        },
        userFirstJwtToken
      );
      // const o = await Order.updateOne(
      //   { _id: orderOne.id },
      //   { $set: { status: 'completed' } }
      // );
      // expect(o.nModified).toBe(1);

      orderTwo = await createOrder(
        {
          uuid: productBootsUuid,
          price: productBoots.price,
        },
        userAnotherJwtToken
      );
      // const o2 = await Order.updateOne(
      //   { _id: orderTwo.id },
      //   { $set: { status: 'completed' } }
      // );
      reviewTwo.orderId = orderTwo.id;
      // expect(o2.nModified).toBe(1);

      orderThreePending = await createOrder(
        {
          uuid: productShortsUuid,
          price: productShorts.price,
        },
        userForthJwtToken
      );
      orderSix = await createOrder(
        {
          uuid: productBootsUuid,
          price: productBoots.price,
        },
        userForthJwtToken
      );
      // const o6 = await Order.updateOne(
      //   { _id: orderSix.id },
      //   { $set: { status: 'completed' } }
      // );
      // expect(o6.nModified).toBe(1);
    });

    // userFirst <-> userAnother follow each other
    beforeAll(done => {
      let Promises = [];
      Promises.push(
        new Promise((resolve, reject) => {
          request(app)
            .post(`/api/users/${userAnother._id}/follow`)
            .set('Authorization', userFirstJwtToken)
            .expect(httpStatus.CREATED)
            .then(({ body }) => {
              expect(body.data.follower).toBe(userFirst._id);
              expect(body.data.following).toBe(userAnother._id);
              expect(Object.keys(body.data).sort()).toEqual(
                ['follower', 'following', 'dateCreated'].sort()
              );
              resolve();
            })
            .catch(e => reject(e));
        })
      );
      Promises.push(
        new Promise((resolve, reject) => {
          request(app)
            .post(`/api/users/${userFirst._id}/follow`)
            .set('Authorization', userAnotherJwtToken)
            .expect(httpStatus.CREATED)
            .then(({ body }) => {
              expect(body.data.follower).toBe(userAnother._id);
              expect(body.data.following).toBe(userFirst._id);
              expect(Object.keys(body.data).sort()).toEqual(
                ['follower', 'following', 'dateCreated'].sort()
              );
              resolve();
            })
            .catch(e => reject(e));
        })
      );
      Promise.all(Promises)
        .then(() => done())
        .catch(e => done(new Error(e)));
    });

    it('should create a review by the buyer (userFirst)', () => {
      return request(app)
        .post(`/api/users/${userAnother._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great seller AAA+',
          rateNumber: 5,
          lang: 'en',
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.CREATED)
        .then(async res => {
          ratingsTotalUserAnother += 5;
          reviewsCountUserAnother++;
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderOne.id);
          expect(o.fromUser).toBe(userFirst._id);
          expect(o.targetUser).toBe(userAnother._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
          const oo = await Order.findById(orderOne.id);
          expect(oo.trackingNumber).toBe('20450072617861');
        });
    });

    it('should NOT create a duplicate review for that order (as buyer)', () => {
      return request(app)
        .post(`/api/users/${userAnother._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great seller AAA+ dupe',
          rateNumber: 3,
          lang: 'en',
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Duplicate review'));
    });

    it('should NOT create a review for that order (as seller) with the wrong tracking number', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great buyer AAA+ dupe',
          rateNumber: 1,
          lang: 'en',
          trackingNumber: '20450072617862',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toBe('The tracking number is not valid')
        );
    });

    it('should create a review by the seller (userAnother)', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great buyer AAA+',
          rateNumber: 5,
          lang: 'en',
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.CREATED)
        .then(res => {
          ratingsTotalUserFirst += 5;
          reviewsCountUserFirst++;
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderOne.id);
          expect(o.fromUser).toBe(userAnother._id);
          expect(o.targetUser).toBe(userFirst._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should NOT create a duplicate review for that order (as seller)', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .send({
          orderId: orderOne.id,
          text: 'great buyer AAA+ dupe',
          rateNumber: 1,
          lang: 'en',
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Duplicate review'));
    });

    it('should NOT create a review with an invalid rateNumber', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          ...reviewTwo,
          rateNumber: 9,
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('must be less than or equal to 5')
        );
    });

    it('should NOT create a review without a verified account', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userNotActiveJwtToken)
        .send(reviewTwo)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain(
            'Please verify your account before creating a review'
          )
        );
    });

    it('should NOT create a review with an invalid order', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          ...reviewTwo,
          orderId: '5ad0d405091374a087a7ffff',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toBe('Invalid order'));
    });

    it('should NOT create a review with an invalid lang', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          ...reviewTwo,
          lang: 'po',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('must be one of [uk, en]')
        );
    });

    it('should NOT create a review with an invalid text', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          ...reviewTwo,
          text: 'gr',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('must be at least 7 characters')
        );
    });

    it('should NOT create a review with an invalid tracking number', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          ...reviewTwo,
          trackingNumber: '000000000',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('length must be 14 characters long')
        );
    });

    it('should NOT create a review for an order I`m not part of', () => {
      return request(app)
        .post(`/api/users/${userAnother._id}/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .send({
          ...reviewTwo,
          orderId: orderSix.id,
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toBe('Invalid order'));
    });

    it('should create a review, even if the order is not completed (as buyer)', () => {
      return request(app)
        .post(`/api/users/${userAnother._id}/reviews`)
        .set('Authorization', userForthJwtToken)
        .send({
          ...reviewTwo,
          orderId: orderThreePending.id,
          trackingNumber: '20450072617862',
        })
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data.order.id).toBe(orderThreePending.id);
          ratingsTotalUserFirst += 5;
          reviewsCountUserFirst += 1;
        });
    });

    it('should NOT create a review with a duplicate tracking number', () => {
      return request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userForthJwtToken)
        .send({
          ...reviewTwo,
          orderId: orderThreePending.id,
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Duplicate tracking number')
        );
    });

    it('should have updated the number of reviews and rating of the buyer', () => {
      return request(app)
        .get(`/api/users/${userAnother._id}`)
        .set('Authorization', userForthJwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.ratingsTotal).toBe(ratingsTotalUserFirst);
          expect(body.reviewsCount).toBe(reviewsCountUserFirst);
        });
    });

    it('should have updated the number of reviews and rating of the seller', () => {
      return request(app)
        .get(`/api/users/${userFirst._id}`)
        .set('Authorization', userForthJwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.ratingsTotal).toBe(ratingsTotalUserAnother);
          expect(body.reviewsCount).toBe(reviewsCountUserAnother);
        });
    });

    it('should not show products which have been reviewed by a buyer (in the feed)', () => {
      return request(app)
        .get('/api/feed/flat')
        .set('Authorization', userFirstJwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.data).toHaveLength(0);
        });
    });
  });

  describe('# GET /api/users/:userId/review', () => {
    // delete all Orders, Reviews, Products and Notifications
    beforeAll(done => {
      const collections = [
        Notification.collection,
        Order.collection,
        Review.collection,
        Product.collection,
      ];

      var todo = collections.length;
      if (!todo) return done();

      collections.forEach(collection => {
        collection.remove({}, { safe: true }, () => {
          if (--todo === 0) done();
        });
      });
    });

    let orderFour, orderFive;

    // userFirst   creates product B
    // userAnother creates product S
    beforeAll(async () => {
      await createProduct(productBoots, userFirstJwtToken).then(p => {
        productBootsUuid = p.uuid;
      });
      await createProduct(productShorts, userAnotherJwtToken).then(p => {
        productShortsUuid = p.uuid;
      });
    });

    // userFirst   buys product S from userAnother (orderFour)
    // userAnother buys product B from userFirst   (orderFive) but NO reviews
    beforeAll(async () => {
      try {
        orderFour = await createOrder(
          { ...productShorts, uuid: productShortsUuid },
          userFirstJwtToken
        );
        // const o = await Order.updateOne(
        //   { _id: orderFour.id },
        //   { $set: { status: 'completed' } }
        // );
        // expect(o.nModified).toBe(1);

        orderFive = await createOrder(
          { ...productBoots, uuid: productBootsUuid },
          userAnotherJwtToken
        );
        // const o2 = await Order.updateOne(
        //   { _id: orderFive.id },
        //   { $set: { status: 'completed' } }
        // );
        // expect(o2.nModified).toBe(1);
      } catch (error) {
        console.error(error);
      }
    });

    /**
     * | from user            | action     | target user | order     |
     * | -------------------- | ---------- | ----------- | --------- |
     * | userFirst (buyer)    | reviews -> | userAnother | orderFour |
     * | userAnother (seller) | reviews -> | userFirst   | orderFour |
     */
    beforeAll(async () => {
      await request(app)
        .post(`/api/users/${userAnother._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .send({
          orderId: orderFour.id,
          text: 'great seller AAA+',
          rateNumber: 5,
          lang: 'en',
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(o.order.id).toBe(orderFour.id);
          expect(o.fromUser).toBe(userFirst._id);
          expect(o.targetUser).toBe(userAnother._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });

      await request(app)
        .post(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .send({
          orderId: orderFour.id,
          text: 'great buyer AAA+',
          rateNumber: 5,
          lang: 'en',
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(o.order.id).toBe(orderFour.id);
          expect(o.fromUser).toBe(userAnother._id);
          expect(o.targetUser).toBe(userFirst._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get all the reviews of a userAnother', () => {
      return request(app)
        .get(`/api/users/${userAnother._id}/reviews`)
        .set('Authorization', userFirstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(2);
          const o = res.body.data[0];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(Object.keys(o.order.product).sort()).toEqual(
            [...productFields, 'comments'].sort()
          );
          expect(Object.keys(o.order.buyer).sort()).toEqual(
            moreUserFields.sort()
          );
          expect(Object.keys(o.order.seller).sort()).toEqual(
            moreUserFields.sort()
          );
          expect(o.fromUser).toBe(userFirst._id);
          expect(o.targetUser).toBe(userAnother._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get all the reviews of a userFirst', () => {
      return request(app)
        .get(`/api/users/${userFirst._id}/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(2);
          const o = res.body.data[1];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(o.fromUser).toBe(userAnother._id);
          expect(o.targetUser).toBe(userFirst._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get the reviews that userAnother received as a seller', () => {
      return request(app)
        .get(`/api/users/${userAnother._id}/reviews/?as=seller`)
        .set('Authorization', userAnotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(1);
          const o = res.body.data[0];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(o.fromUser).toBe(userFirst._id);
          expect(o.targetUser).toBe(userAnother._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get the reviews that userFirst received as a buyer', () => {
      return request(app)
        .get(`/api/users/${userFirst._id}/reviews/?as=buyer`)
        .set('Authorization', userAnotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(1);
          const o = res.body.data[0];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(o.fromUser).toBe(userAnother._id);
          expect(o.targetUser).toBe(userFirst._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get the reviews that userFirst received as a seller', () => {
      return request(app)
        .get(`/api/users/${userFirst._id}/reviews/?as=seller`)
        .set('Authorization', userAnotherJwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data).toHaveLength(0));
    });

    it('should get the reviews that userAnother received as a buyer', () => {
      return request(app)
        .get(`/api/users/${userAnother._id}/reviews/?as=buyer`)
        .set('Authorization', userAnotherJwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data).toHaveLength(0));
    });

    it('should NOT get the reviews of an invalid user', () => {
      return request(app)
        .get(`/api/users/5ad104f6d07421b88545ffff/reviews`)
        .set('Authorization', userAnotherJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Invalid userId'));
    });

    // userFirst's orders (as buyer and seller)
    it('should get all my orders with my review status', () => {
      return request(app)
        .get('/api/orders')
        .set('Authorization', userFirstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Array.isArray(o));
          expect(o).toHaveLength(2);
          expect(o[0].id).toBe(orderFour.id);
          expect(typeof o[0].reviewFromBuyer).toBe('string');
          expect(typeof o[0].reviewFromSeller).toBe('string');
          expect(o[1].id).toBe(orderFive.id);
          expect(o[1].reviewFromBuyer).toBeUndefined();
          expect(o[1].reviewFromSeller).toBeUndefined();
        });
    });
  });
});
