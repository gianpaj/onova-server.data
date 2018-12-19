// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import path from 'path';
import httpStatus from 'http-status';
import BSON from 'bson';

import config from '../config/config';
import app from '../index';
import {
  beforeAllTests,
  clearJobs,
  createUserAndLogin,
  followUser,
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

/* TODO: flow - :: extends UserDoc */
type User = {
  _id: MongoId,
  token: string,
};

let users: Array<User> = [
  {
    username: 'user0',
    emailAddress: 'gianpa+test0@gmail.com',
    password: 'express0',
  },
  {
    username: 'user1',
    emailAddress: 'gianpa+test1@gmail.com',
    password: 'express1',
  },
];

const product = {
  categoryIds: [1, 2, 3],
  typeIds: [1, 2, 3],
  tags: ['winter', 'spring2007'], // optional
  description: 'nice boots',
  price: '1100.99',
  photos: ['http://storage.googleapis.com/1527232263107'],
};

describe('## Drops feed APIs', () => {
  beforeAll(beforeAllTests);

  // create 2 users and follow each other
  beforeAll(async () => {
    const usersAndTokens = await Promise.all(users.map(createUserAndLogin));
    users = usersAndTokens.map(user => ({
      ...user.user,
      token: user.jwtToken,
    }));

    await clearJobs();

    /**
     * | from  |            | target |
     * | ----- | ---------- | ------ |
     * | user0 | follows -> | user1  |
     * | user1 | follows -> | user0  |
     */
    await Promise.all([
      followUser(users[0].token, users[1]._id),
      followUser(users[1].token, users[0]._id),
    ]);
  });

  it("should get an empty list if my followers haven't posted anything", () => {
    return request(app)
      .get('/api/feed/drops')
      .set('Authorization', users[0].token)
      .expect(httpStatus.OK)
      .then(({ body }) => expect(body.data).toHaveLength(0));
  });

  describe('# POST /api/v2/drop', () => {
    beforeAll(() => {
      return request(app)
        .post('/api/photos/upload')
        .set('Authorization', users[1].token)
        .attach('photo', path.join(__dirname, 'images/boots-larger.jpeg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data).toContain(
            'https://storage.googleapis.com/temp-uploads.onova.co/'
          );
          product.photos = [body.data];
        });
    });

    it('should NOT make a drop with a item price to low', () => {
      const dropId = new BSON.ObjectId();
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[1].token)
        .send({
          products: [
            { ...product, price: (config.settings.minPrice - 10).toString() },
          ],
          dropId,
          date: new Date(),
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain(
            'Invalid product price. The minimum price is'
          )
        );
    });

    it('should NOT create a drop with invalid item images', () => {
      const dropId = new BSON.ObjectId();
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[1].token)
        .send({
          products: [{ ...product, photos: ['http://asdfasd'] }],
          dropId,
          date: new Date(),
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Invalid photos'));
    });
  });
});
