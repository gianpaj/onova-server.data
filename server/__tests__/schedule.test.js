// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';
import addDays from 'date-fns/add_days';

import app from '../index';
import { agenda } from '../config/express';

import Product from '../models/product.model';
import { createUserAndLogin, productFields, beforeAllTests } from './utils';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

describe('## Schedule APIs', () => {
  beforeAll(beforeAllTests);

  // $FlowFixMe
  let user1: UserDoc = {
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    password: 'expressos',
  };

  // $FlowFixMe
  let user2: UserDoc = {
    username: 'secondperson',
    emailAddress: 'gianpa+test2@gmail.com',
    password: 'express2',
  };

  // $FlowFixMe
  let user3: UserDoc = {
    username: 'thirdrperson',
    emailAddress: 'gianpa+test3@gmail.com',
    password: 'express3',
  };

  let product = {
    categoryIds: [1, 2, 3],
    date: new Date(Date.now() + 12000), // 12 seconds
    typeIds: [1, 2, 3],
    tags: ['winter', 'spring2007'], // optional
    description: 'nice boots',
    price: '100.99',
    photos: ['http://storage.googleapis.com/1527232263107'],
    // socials: 'fb',
  };

  let productUuid, jwtToken1, jwtToken2, jwtToken3;

  // let productsCounter = 0;

  // create 3 users/sellers
  beforeAll(async () => {
    const { user: resUser, jwtToken: token } = await createUserAndLogin(user1);
    user1._id = resUser._id;
    jwtToken1 = token;
    const { user: resUser2, jwtToken: token2 } = await createUserAndLogin(
      user2
    );
    user2._id = resUser2._id;
    jwtToken2 = token2;
    const { user: resUser3, jwtToken: token3 } = await createUserAndLogin(
      user3
    );
    user3._id = resUser3._id;
    jwtToken3 = token3;
    await request(app)
      .put(`/api/users/${user1._id}`)
      .set('Authorization', jwtToken1)
      .attach('profilePic', path.join(__dirname, 'images/profilepic.jpg'))
      .expect(httpStatus.OK);
  });

  // describe('# POST /api/schedule', () => {
  //   it("should NOT scheduled an item to FB if user doesn't have a FB token", () => {
  //     return request(app)
  //       .post('/api/schedule')
  //       .set('Authorization', jwtToken)
  //       .send(product)
  //       .expect(httpStatus.BAD_REQUEST)
  //       .then(({ body }) =>
  //         expect(body.message).toContain('Please authorize with Facebook')
  //       );
  //   });
  // });

  describe('# POST /api/schedule', () => {
    let pathImage1;
    beforeAll(async () => {
      // update Facebook Token
      // await request(app)
      //   .put(`/api/users/${user._id}`)
      //   .set('Authorization', jwtToken)
      //   .send({
      //     ...user,
      //     _id: undefined,
      //     facebook: '101010101',
      //     accessToken: 'FBaccesssToen1020Numbers',
      //   })
      //   .expect(httpStatus.OK)
      //   .then(({ body }) => {
      //     expect(body.facebook).toBe('101010101');
      //   });
      await request(app)
        .post('/api/photos/upload')
        .set('Authorization', jwtToken1)
        .attach('photo', path.join(__dirname, 'images/boots-larger.jpeg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const { data } = body;
          expect(data).toContain(
            'https://storage.googleapis.com/temp-uploads.onova.co/'
          );
          pathImage1 = data;
        });
    });

    it('should NOT schedule invalid images', () => {
      return request(app)
        .post('/api/schedule')
        .set('Authorization', jwtToken1)
        .send({ ...product, photos: ['http://asdfasd'] })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Invalid photos'));
    });

    it('should schedule a listing', done => {
      let myProductFields = [...productFields, 'comments'];
      myProductFields = myProductFields.filter(f => f !== 'createdAt');
      myProductFields = myProductFields.filter(f => f !== 'updatedAt');

      product.photos = [pathImage1];

      request(app)
        .post('/api/schedule')
        .set('Authorization', jwtToken1)
        .send(product)
        .expect(httpStatus.CREATED)
        .then(async ({ body }) => {
          const p = body.data.data.product;
          // expect(body.data.data.socials).toEqual([product.socials]);
          expect(body.data.nextRunAt).toBe(product.date.toISOString());
          expect(p.categoryIds.sort()).toEqual(product.categoryIds);
          expect(p.currency).toBe('UAH');
          expect(p.description).toBe(product.description);
          expect(p.photoURIs[0]).toContain('/products/');
          expect(p.price).toBe(product.price);
          expect(p.seller).toBe(user1._id);
          expect(p.status).toBe('forsale');
          expect(Array.isArray(p.tags));
          expect(p.tags).toEqual(product.tags);
          expect(p.typeIds.sort()).toEqual(product.typeIds);
          expect(Object.keys(p).sort()).toEqual([...myProductFields].sort());
          productUuid = p.uuid;
          // productsCounter++;

          let count = 0;
          let found;
          const waitFor = 15; // seconds
          const interval = Math.floor((waitFor * 10000) / 100);

          // Check a Product notification has been created every 100ms for X seconds
          const timer = setInterval(async () => {
            count++;
            found = await Product.findOne({ uuid: productUuid });
            if (found) {
              clearInterval(timer);

              expect(found.uuid).toBe(productUuid);
              expect(p.photoURIs[0]).not.toContain('thumb');
              expect(p.photoURIs[0]).toContain('/products/');
              done();
            }
            if (count >= waitFor) {
              clearInterval(timer);
              throw new Error('timeout');
            }
            // console.log(count);
          }, interval);
        });
    });

    it('should NOT schedule a listing in the past', () => {
      return request(app)
        .post('/api/schedule')
        .set('Authorization', jwtToken1)
        .send({ ...product, date: new Date('2018-05-28T20:23:20.000Z') })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('must be larger than or equal')
        );
    });

    // it('should schedule a listing earlier today', () => {
    //   return request(app)
    //     .post('/api/schedule')
    //     .set('Authorization', jwtToken)
    //     .send({ ...product, date: new Date(new Date().setHours(1)) })
    //     .expect(httpStatus.CREATED)
    //     .then(({ body }) =>
    //       expect(body.data.data.product.description).toBe(product.description)
    //     );
    // });

    it('should NOT scheduled an item after 3 months from today', () => {
      return request(app)
        .post('/api/schedule')
        .set('Authorization', jwtToken1)
        .send({ ...product, date: addDays(new Date(Date.now()), 91) })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Cannot schedule listings after 90')
        );
    });
  });

  describe('# GET /api/schedule', () => {
    beforeAll(done => {
      agenda.purge(async err => {
        if (err) return console.error(err) && done(err);
        product.photos = [
          'https://storage.googleapis.com/temp-uploads.onova.co/',
        ];

        await request(app)
          .post('/api/schedule')
          .set('Authorization', jwtToken1)
          .send(product)
          .expect(httpStatus.CREATED);

        await request(app)
          .post('/api/schedule')
          .set('Authorization', jwtToken2)
          .send(product)
          .expect(httpStatus.CREATED);
        done();
      });
    });

    it('should NOT get scheduled listings without auth', () => {
      return request(app)
        .get('/api/schedule')
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should get user1 scheduled listings', () => {
      return request(app)
        .get('/api/schedule')
        .set('Authorization', jwtToken1)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.data.length).toBe(1);
          expect(body.data[0].seller).toBe(user1._id);
        });
    });

    it('should get no scheduled listings', () => {
      return request(app)
        .get('/api/schedule')
        .set('Authorization', jwtToken3)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.data.length).toBe(0);
        });
    });
  });
});
