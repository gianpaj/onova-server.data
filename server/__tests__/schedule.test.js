// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';
import addDays from 'date-fns/add_days';

import app from '../index';
import { agenda } from '../config/express';
import config from '../config/config';

import DefaultFollow from '../models/defaultFollow.model';
import Product from '../models/product.model';
import Tag from '../models/tag.model';
import User from '../models/user.model';
import Verification from '../models/verification.model';
import { createUserAndLogin, productFields } from './utils';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

describe('## Schedule APIs', () => {
  beforeAll(done => {
    const collections = [
      Product.collection,
      DefaultFollow.collection,
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

  let user = {
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    mobileNumber: '1234567890', // optional
    // displayName: 'first user',
    password: 'expressos',
  };

  let anotherUser = {
    username: 'anotherperson',
    emailAddress: 'gianpa+test2@gmail.com',
    mobileNumber: '1234567890', // optional
    password: 'express2',
  };

  let product = {
    categoryIds: [1, 2, 3],
    date: new Date(Date.now() + 12000), // 12 seconds
    typeIds: [1, 2, 3],
    tags: ['winter', 'spring2007'], // optional
    description: 'nice boots',
    price: '100.99',
    photos: ['http://storage.googleapis.com/1527232263107'],
    socials: 'fb',
  };

  let anotherProduct = {
    categoryIds: [1],
    typeIds: [1, 3],
    description: 'nice jacket',
    price: '230.99',
    photos: ['http://storage.googleapis.com/1527232263107'],
    socials: ['fb'],
  };

  let thirdProduct = {
    categoryIds: [2],
    typeIds: [1, 3],
    tags: ['WINTER'],
    description: 'nice scarf',
    price: '30',
    photos: ['http://storage.googleapis.com/1527232263107'],
    socials: ['fb'],
  };

  let productUuid;
  let jwtToken;
  let anotherJwtToken;
  let anotherProdUuid;
  let thirdProdUuid;

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
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(() => {
        return createUserAndLogin(anotherUser).then(
          ({ user: resUser, jwtToken: token }) => {
            anotherUser._id = resUser._id;
            anotherJwtToken = token;
            done();
          }
        );
      });
  });

  describe('# POST /api/schedule', () => {
    it("should NOT scheduled an item to FB if user doesn't have a FB token", () => {
      return request(app)
        .post('/api/schedule')
        .set('Authorization', jwtToken)
        .send(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Please authorize with Facebook')
        );
    });
  });

  describe('# POST /api/schedule', () => {
    let pathImage1;
    // update Facebook Token
    beforeAll(async () => {
      user.facebook = '101010101';
      user.accessToken = 'FBaccesssToen1020Numbers';
      await request(app)
        .put(`/api/users/${user._id}`)
        .set('Authorization', jwtToken)
        .send({ ...user, _id: undefined })
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.facebook).toBe('101010101');
        });
      await request(app)
        .post('/api/photos/upload')
        .set('Authorization', jwtToken)
        .attach('photo', path.join(__dirname, 'images/boots-large.jpg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data.originalname).toBe('boots-large.jpg');
          expect(body.data.fieldname).toBe('photo');
          expect(body.data.encoding).toBe('7bit');
          expect(body.data.mimetype).toBe('image/jpeg');
          expect(body.data['thumb.jpeg'].path).toContain(
            'storage.googleapis.com/temp-uploads.onova.co/'
          );
          expect(body.data['thumb.jpeg'].filename).toContain('thumb');
          expect(body.data['.jpeg'].path).toContain(
            'storage.googleapis.com/temp-uploads.onova.co/'
          );
          expect(body.data['.jpeg'].filename).toContain('-.jpeg');
          pathImage1 = body.data['.jpeg'].path;
        });
    });

    it.skip('should not upload a small image', () => {
      return request(app)
        .post('/api/photos/upload')
        .set('Authorization', jwtToken)
        .attach('photo', path.join(__dirname, 'images/boots1.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Product image is too small')
        );
    });

    it('should NOT schedule invalid images a small image', () => {
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

          let found;
          // Check a Product notification has been created
          do {
            found = await Product.findOne({ uuid: productUuid });
          } while (!found);
          expect(found.uuid).toBe(productUuid);
          done();
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
