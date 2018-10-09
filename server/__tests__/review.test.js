// @flow

import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import { Order, Product, Review } from '../models';
import {
  createUserAndLogin,
  createProduct,
  createOrder,
  productFields,
  beforeAllTests,
} from './utils';

// GET & PUT /api/users/<id>/reviews should only return these fields
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
  beforeAll(beforeAllTests);

  let user1 = {
    username: 'userfirst',
    emailAddress: 'userfirst@gmail.com',
    password: 'expressos',
    pushToken: 'userfirstPushToken',
    platform: 'android',
  };

  let user2 = {
    username: 'useranother',
    emailAddress: 'useranother@gmail.com',
    password: 'express2',
    pushToken: 'user2PushToken',
    platform: 'ios',
  };

  let nonActiveUser = {
    username: 'nonactiveuser',
    emailAddress: 'nonactiveuser@gmail.com',
    password: 'expressos',
  };

  let user4 = {
    username: 'userfour',
    emailAddress: 'userfour@gmail.com',
    password: 'expressos4',
  };

  let productBoots = {
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    tags: ['winter', 'spring2007'], // optional
    description: 'nice boots',
    // seller id is the user who creates the product
    price: '100.99', // if no decimal points .00 will be added
    photos: [
      'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
    ],
  };

  let productFlipflops = {
    categoryIds: [3],
    typeIds: [1, 3],
    tags: ['summer'],
    description: 'nice flipflops',
    price: '10.99',
    photos: [
      'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
    ],
  };

  let productShorts = {
    categoryIds: [2],
    typeIds: [2, 3],
    description: 'nice shorts',
    price: '200.50',
    photos: [
      'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
    ],
  };

  let reviewTwo = {
    text: 'great stuff',
    rateNumber: 5,
    lang: 'en',
    trackingNumber: '20450072617861',
  };

  let productBootsUuid, productBootsUuid2;
  let productFlipflopsUuid;
  let productShortsUuid, productShortsUuid2;
  let jwtToken1, jwtToken2, jwtToken4;
  let userNotActiveJwtToken;
  let reviewsCountUserAnother = 0;
  let reviewsCountUserFirst = 0;
  let ratingsTotalUserFirst = 0;
  let ratingsTotalUserAnother = 0;

  // create 3 users. 1 not activated
  beforeAll(async () => {
    const { user: resUser, jwtToken: token } = await createUserAndLogin(user1);
    user1._id = resUser._id;
    jwtToken1 = token;
    const { user: resUser2, jwtToken: token2 } = await createUserAndLogin(
      user2
    );
    user2._id = resUser2._id;
    jwtToken2 = token2;
    const { user: resUser4, jwtToken: token4 } = await createUserAndLogin(
      user4
    );
    user4._id = resUser4._id;
    jwtToken4 = token4;
    const { body } = await request(app)
      .post('/api/users')
      .send(nonActiveUser)
      .expect(httpStatus.CREATED);
    const resUser5 = body.data;
    expect(typeof resUser5._id).toBe('string');
    expect(resUser5.username).toBe(nonActiveUser.username);
    expect(resUser5.emailAddress).toBe(nonActiveUser.emailAddress);
    expect(resUser5.accountStatus).toBe('notverified');
    expect(resUser5).not.toHaveProperty('password');
    await request(app)
      .post('/api/auth/login')
      .send({
        emailAddress: nonActiveUser.emailAddress,
        password: nonActiveUser.password,
      })
      .expect(httpStatus.OK)
      .then(res => {
        expect(res.body).toHaveProperty('token');
        userNotActiveJwtToken = res.body.token;
      });
  });

  // create 5 products and delete 1 of them
  beforeAll(async () => {
    try {
      await createProduct(productBoots, jwtToken1).then(p => {
        productBootsUuid = p.uuid;
      });
      await createProduct(productBoots, jwtToken1).then(p => {
        productBootsUuid2 = p.uuid;
      });
      await createProduct(productShorts, jwtToken2).then(p => {
        productShortsUuid = p.uuid;
      });
      await createProduct(productShorts, jwtToken2).then(p => {
        productShortsUuid2 = p.uuid;
      });

      // create product and delete it
      const p = await createProduct(productFlipflops, jwtToken1);

      productFlipflopsUuid = p.uuid;
      const res = await request(app)
        .delete(`/api/products/${productFlipflopsUuid}`)
        .set('Authorization', jwtToken1)
        .expect(httpStatus.NO_CONTENT);
      expect(res.body).toMatchObject({});
    } catch (error) {
      console.error(error);
      throw new Error(error);
    }
  });

  describe('# POST /api/users/:userId/review', () => {
    let orderOne, orderTwo, orderThreePending, orderSix;

    // user1 orders productShorts (from user2)  [orderOne]
    // user2 orders productBoots  (from user1)  [orderTwo] {reviewTwo}
    // user4 orders productShorts2 (from user2) [orderThreePending]
    // user4 orders productBoots2  (from user1) [orderSix]
    beforeAll(async () => {
      try {
        orderOne = await createOrder(
          {
            uuid: productShortsUuid,
            price: productShorts.price,
          },
          jwtToken1
        );
        const o = await Order.updateOne(
          { _id: orderOne.id },
          { $set: { status: 'completed' } }
        );
        expect(o.nModified).toBe(1);

        orderTwo = await createOrder(
          {
            uuid: productBootsUuid,
            price: productBoots.price,
          },
          jwtToken2
        );
        // const o2 = await Order.updateOne(
        //   { _id: orderTwo.id },
        //   { $set: { status: 'completed' } }
        // );
        reviewTwo.orderId = orderTwo.id;
        // expect(o2.nModified).toBe(1);

        orderThreePending = await createOrder(
          {
            uuid: productShortsUuid2,
            price: productShorts.price,
          },
          jwtToken4
        );
        orderSix = await createOrder(
          {
            uuid: productBootsUuid2,
            price: productBoots.price,
          },
          jwtToken4
        );
        const o6 = await Order.updateOne(
          { _id: orderSix.id },
          { $set: { status: 'completed' } }
        );
        expect(o6.nModified).toBe(1);
      } catch (error) {
        console.error(error);
      }
    });

    // user1 <-> user2 follow each other
    beforeAll(async () => {
      try {
        await request(app)
          .post(`/api/users/${user2._id}/follow`)
          .set('Authorization', jwtToken1)
          .expect(httpStatus.CREATED)
          .then(({ body }) => {
            expect(body.data.follower).toBe(user1._id);
            expect(body.data.following).toBe(user2._id);
            expect(Object.keys(body.data).sort()).toEqual(
              ['follower', 'following', 'dateCreated'].sort()
            );
          });
        await request(app)
          .post(`/api/users/${user1._id}/follow`)
          .set('Authorization', jwtToken2)
          .expect(httpStatus.CREATED)
          .then(({ body }) => {
            expect(body.data.follower).toBe(user2._id);
            expect(body.data.following).toBe(user1._id);
            expect(Object.keys(body.data).sort()).toEqual(
              ['follower', 'following', 'dateCreated'].sort()
            );
          });
      } catch (e) {
        console.error(e);
        throw new Error(e);
      }
    });

    // user1 reviews user2 +5 [orderOne] with trackingNumber 20450072617861
    it('should create a review by the buyer', () => {
      return request(app)
        .post(`/api/users/${user2._id}/reviews`)
        .set('Authorization', jwtToken1)
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
          expect(o.order.citySender).toBe('Львів');
          expect(o.order.cityRecipient).toBe('Чернівці');
          expect(o.fromUser).toBe(user1._id);
          expect(o.targetUser).toBe(user2._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
          const oo = await Order.findById(orderOne.id);
          expect(oo.trackingNumber).toBe('20450072617861');
        });
    });

    it('should NOT create a duplicate review for that order (as buyer)', () => {
      return request(app)
        .post(`/api/users/${user2._id}/reviews`)
        .set('Authorization', jwtToken1)
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
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken2)
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

    // user2 reviews user1 +5 [orderOne] with trackingNumber 20450072617861
    it('should create a review by the seller', () => {
      return request(app)
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken2)
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
          expect(o.fromUser).toBe(user2._id);
          expect(o.targetUser).toBe(user1._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should NOT create a duplicate review for the same order (as seller)', () => {
      return request(app)
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken2)
        .send({
          orderId: orderOne.id,
          text: 'great buyer AAA+ dupe',
          rateNumber: 5,
          lang: 'en',
          trackingNumber: '20450072617861',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Duplicate review'));
    });

    it('should NOT create a review with an invalid rateNumber', () => {
      return request(app)
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken1)
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
        .post(`/api/users/${user1._id}/reviews`)
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
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken1)
        .send({
          ...reviewTwo,
          orderId: '5ad0d405091374a087a7ffff',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toBe('Invalid order'));
    });

    it('should NOT create a review with an invalid lang', () => {
      return request(app)
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken1)
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
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken1)
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
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken1)
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
        .post(`/api/users/${user2._id}/reviews`)
        .set('Authorization', jwtToken2)
        .send({
          ...reviewTwo,
          orderId: orderSix.id,
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toBe('Invalid order'));
    });

    // user4 reviews user1 [orderSix] with trackingNumber 20450072617862
    it('should create a review by the buyer)', () => {
      return request(app)
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken4)
        .send({
          ...reviewTwo,
          orderId: orderSix.id,
          trackingNumber: '20450072617862',
        })
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data.order.id).toBe(orderSix.id);
          ratingsTotalUserFirst += 5;
          reviewsCountUserFirst++;
        });
    });

    it('should NOT create a review on another order with a duplicate tracking number', () => {
      return request(app)
        .post(`/api/users/${user2._id}/reviews`)
        .set('Authorization', jwtToken4)
        .send({
          ...reviewTwo,
          orderId: orderThreePending.id,
          trackingNumber: '20450072617862',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toBe('Duplicate tracking number')
        );
    });

    it('should have updated the number of reviews and rating of the buyer', () => {
      return request(app)
        .get(`/api/users/${user1._id}`)
        .set('Authorization', jwtToken4)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.ratingsTotal).toBe(ratingsTotalUserFirst);
          expect(body.reviewsCount).toBe(reviewsCountUserFirst);
        });
    });

    it('should have updated the number of reviews and rating of the seller', () => {
      return request(app)
        .get(`/api/users/${user2._id}`)
        .set('Authorization', jwtToken4)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.ratingsTotal).toBe(ratingsTotalUserAnother);
          expect(body.reviewsCount).toBe(reviewsCountUserAnother);
        });
    });

    it('should not show products in the feed which have been reviewed by a buyer', () => {
      return request(app)
        .get('/api/feed/flat')
        .set('Authorization', jwtToken1)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.data).toHaveLength(0);
        });
    });
  });

  describe.skip('# GET /api/users/:userId/review', () => {
    // delete all Product, Orders and Reviews
    beforeAll(done => {
      const collections = [
        Order.collection,
        Product.collection,
        Review.collection,
      ];

      var todo = collections.length;
      if (!todo) return done();

      collections.forEach(collection => {
        collection.deleteMany({}, { safe: true }, () => {
          if (--todo === 0) done();
        });
      });
    });

    let orderFour, orderFive;

    // user1 lists product B
    // user2 lists product S
    beforeAll(async () => {
      await createProduct(productBoots, jwtToken1).then(p => {
        productBootsUuid = p.uuid;
      });
      await createProduct(productShorts, jwtToken2).then(p => {
        productShortsUuid = p.uuid;
      });
    });

    // user1 buys product S from user2 (orderFour)
    // user2 buys product B from user1 (orderFive) but NO reviews
    beforeAll(async () => {
      try {
        orderFour = await createOrder(
          { ...productShorts, uuid: productShortsUuid },
          jwtToken1
        );
        // const o = await Order.updateOne(
        //   { _id: orderFour.id },
        //   { $set: { status: 'completed' } }
        // );
        // expect(o.nModified).toBe(1);

        orderFive = await createOrder(
          { ...productBoots, uuid: productBootsUuid },
          jwtToken2
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
     * | from user      | action     | target user | order     |
     * | -------------- | ---------- | ----------- | --------- |
     * | user1 (buyer)  | reviews -> | user2       | orderFour |
     * | user2 (seller) | reviews -> | user1       | orderFour |
     */
    beforeAll(async () => {
      await request(app)
        .post(`/api/users/${user2._id}/reviews`)
        .set('Authorization', jwtToken1)
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
          expect(o.fromUser).toBe(user1._id);
          expect(o.targetUser).toBe(user2._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });

      await request(app)
        .post(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken2)
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
          expect(o.fromUser).toBe(user2._id);
          expect(o.targetUser).toBe(user1._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get all the reviews of a user2', () => {
      return request(app)
        .get(`/api/users/${user2._id}/reviews`)
        .set('Authorization', jwtToken1)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(2);
          const o = res.body.data[1];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(Object.keys(o.order.product).sort()).toEqual(
            [...productFields, 'comments'].sort()
          );
          expect(Object.keys(o.order.buyer).sort()).toMatchSnapshot();
          expect(Object.keys(o.order.seller).sort()).toMatchSnapshot();
          expect(o.fromUser).toBe(user1._id);
          expect(o.targetUser).toBe(user2._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get all the reviews of a user1', () => {
      return request(app)
        .get(`/api/users/${user1._id}/reviews`)
        .set('Authorization', jwtToken2)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(2);
          const o = res.body.data[0];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(o.fromUser).toBe(user2._id);
          expect(o.targetUser).toBe(user1._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get the reviews that user2 received as a seller', () => {
      return request(app)
        .get(`/api/users/${user2._id}/reviews/?as=seller`)
        .set('Authorization', jwtToken2)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(1);
          const o = res.body.data[0];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(o.fromUser).toBe(user1._id);
          expect(o.targetUser).toBe(user2._id);
          expect(o.text).toBe('great seller AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get the reviews that user1 received as a buyer', () => {
      return request(app)
        .get(`/api/users/${user1._id}/reviews/?as=buyer`)
        .set('Authorization', jwtToken2)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(1);
          const o = res.body.data[0];
          expect(Object.keys(o).sort()).toEqual(reviewFields.sort());
          expect(o.order.id).toBe(orderFour.id);
          expect(o.order.priceOfItem).toBe(productShorts.price);
          expect(o.fromUser).toBe(user2._id);
          expect(o.targetUser).toBe(user1._id);
          expect(o.text).toBe('great buyer AAA+');
          expect(o.rateNumber).toBe(5);
          expect(o.lang).toBe('en');
        });
    });

    it('should get the reviews that user1 received as a seller', () => {
      return request(app)
        .get(`/api/users/${user1._id}/reviews/?as=seller`)
        .set('Authorization', jwtToken2)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data).toHaveLength(0));
    });

    it('should get the reviews that user2 received as a buyer', () => {
      return request(app)
        .get(`/api/users/${user2._id}/reviews/?as=buyer`)
        .set('Authorization', jwtToken2)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data).toHaveLength(0));
    });

    it('should NOT get the reviews of an invalid user', () => {
      return request(app)
        .get(`/api/users/5ad104f6d07421b88545ffff/reviews`)
        .set('Authorization', jwtToken2)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Invalid userId'));
    });

    // user1's orders (as buyer and seller)
    it('should get all my orders with my review status', () => {
      return request(app)
        .get('/api/orders')
        .set('Authorization', jwtToken1)
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
