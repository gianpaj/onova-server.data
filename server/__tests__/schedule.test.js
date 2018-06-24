// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';
import addDays from 'date-fns/add_days';

import app from '../index';
import { agenda } from '../config/express';
import config from '../config/config';

import Product from '../models/product.model';
import Tag from '../models/tag.model';
import { createUserAndLogin, productFields, beforeAllTests } from './utils';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

describe('## Schedule APIs', () => {
  beforeAll(beforeAllTests);

  let user = {
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    password: 'expressos',
  };

  let product = {
    categoryIds: [1, 2, 3],
    date: new Date(Date.now() + 12000), // 12 seconds
    typeIds: [1, 2, 3],
    tags: ['winter', 'spring2007'], // optional
    description: 'nice boots',
    price: '100.99',
    photos: ['http://storage.googleapis.com/1527232263107'],
    socials: 'vk',
  };

  let productUuid;
  let jwtToken;

  let productsCounter = 0;

  // create 2 users/sellers + Tag and upload profile pic of a seller
  beforeAll(done => {
    createUserAndLogin(user)
      .then(({ user: resUser, jwtToken: token }) => {
        user._id = resUser._id;
        jwtToken = token;
      })
      .then(() => {
        return request(app)
          .put(`/api/users/${user._id}`)
          .set('Authorization', jwtToken)
          .attach('profilePic', path.join(__dirname, 'images/profilepic.jpg'))
          .expect(httpStatus.OK);
      })
      // .then(() => Tag.create([{ _id: 'winter' }, { _id: 'summer' }]))
      .then(() => done());
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
    // update Facebook Token
    beforeAll(async () => {
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
        .set('Authorization', jwtToken)
        .attach('photo', path.join(__dirname, 'images/boots-large.jpg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const { data } = body;
          expect(data.fieldname).toBe('photo');
          expect(data.originalname).toBe('boots-large.jpg');
          expect(data.encoding).toBe('7bit');
          expect(data.mimetype).toBe('image/jpeg');
          expect(data['thumb.jpeg'].path).toContain(
            'storage.googleapis.com/temp-uploads.onova.co/'
          );
          expect(data['thumb.jpeg'].filename).toContain('thumb');
          expect(data['.jpeg'].path).toContain(
            'storage.googleapis.com/temp-uploads.onova.co/'
          );
          expect(data['.jpeg'].filename).toContain('-.jpeg');
          expect(Object.keys(data).sort()).toEqual([
            '.jpeg',
            'encoding',
            'fieldname',
            'mimetype',
            'originalname',
            'thumb.jpeg',
          ]);
          pathImage1 = data['.jpeg'].path;
        });
    });

    // it('should not upload a small image', () => {
    //   return request(app)
    //     .post('/api/photos/upload')
    //     .set('Authorization', jwtToken)
    //     .attach('photo', path.join(__dirname, 'images/boots1.jpg'))
    //     .expect(httpStatus.BAD_REQUEST)
    //     .then(({ body }) =>
    //       expect(body.message).toContain('Product image is too small')
    //     );
    // });

    it('should NOT schedule invalid images', () => {
      return request(app)
        .post('/api/schedule')
        .set('Authorization', jwtToken)
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
        .set('Authorization', jwtToken)
        .send(product)
        .expect(httpStatus.CREATED)
        .then(async ({ body }) => {
          const p = body.data.data.product;
          expect(body.data.data.socials).toEqual([product.socials]);
          expect(body.data.nextRunAt).toBe(product.date.toISOString());
          expect(p.categoryIds.sort()).toEqual(product.categoryIds);
          expect(p.currency).toBe('UAH');
          expect(p.description).toBe(product.description);
          expect(p.photoURIs[0]).toContain('/products/');
          expect(p.price).toBe(product.price);
          expect(p.seller).toBe(user._id);
          expect(p.status).toBe('forsale');
          expect(Array.isArray(p.tags));
          expect(p.tags).toEqual(product.tags);
          expect(p.typeIds.sort()).toEqual(product.typeIds);
          expect(Object.keys(p).sort()).toEqual([...myProductFields].sort());
          productUuid = p.uuid;
          productsCounter++;

          let count = 0;
          let found;
          const waitFor = 15; // seconds
          const interval = Math.floor(waitFor * 10000 / 100);

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
            console.log(count);
          }, interval);
        });
    });

    it('should NOT schedule a listing in the past', () => {
      return request(app)
        .post('/api/schedule')
        .set('Authorization', jwtToken)
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
        .set('Authorization', jwtToken)
        .send({ ...product, date: addDays(new Date(Date.now()), 91) })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Cannot schedule listings after 90')
        );
    });
  });
});
