// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import Follow from '../models/follow.model';
import User from '../models/user.model';
import Block from '../models/block.model';
import Product from '../models/product.model';
import Verification from '../models/verification.model';
import { createUserAndLogin, createProduct } from './utils';

const blockFields = ['createdAt', '_id', 'sourceUser', 'targetUser'];

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

describe('## Block methods', () => {
  beforeAll(done => {
    const collections = [
      User.collection,
      Block.collection,
      Follow.collection,
      Product.collection,
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

  let firstUser = {
    username: 'firstUser',
    emailAddress: 'gianpa+test@gmail.com',
    password: 'expressos',
  };

  const product = {
    categoryIds: [2],
    typeIds: [3],
    description: 'nice boots',
    price: '100.99',
  };

  let users = [
    {
      username: 'user1',
      emailAddress: 'gianpa+user1@gmail.com',
      password: 'express2',
    },
    {
      username: 'user2',
      emailAddress: 'gianpa+user2@gmail.com',
      password: 'express2',
    },
    {
      username: 'user3',
      emailAddress: 'gianpa+user3@gmail.com',
      password: 'express2',
    },
    {
      username: 'user4',
      emailAddress: 'gianpa+user4@gmail.com',
      password: 'express2',
    },
    {
      username: 'user5',
      emailAddress: 'gianpa+user5@gmail.com',
      password: 'express2',
    },
  ];

  // create 6 users
  beforeAll(async () => {
    for (let i = 0; i < users.length; i++) {
      const { user, jwtToken } = await createUserAndLogin(users[i]);
      users[i]._id = user._id;
      users[i].jwtToken = jwtToken;
    }

    const { user, jwtToken } = await createUserAndLogin(firstUser);
    firstUser._id = user._id;
    firstUser.jwtToken = jwtToken;

    // firstUser posts an item
    const p1 = await createProduct(product, jwtToken);
    firstUser.productUuid = p1.uuid;

    // user 0 posts an item
    const p2 = await createProduct(product, users[0].jwtToken);
    users[0].productUuid = p2.uuid;

    // user 1 posts an item
    const p3 = await createProduct(product, users[1].jwtToken);
    users[1].productUuid = p3.uuid;

    // firstUser -- follows --> user 0
    await request(app)
      .post(`/api/users/${users[0]._id}/follow`)
      .set('Authorization', firstUser.jwtToken)
      .then(({ body }) => {
        expect(body.data.follower).toBe(firstUser._id);
        firstUser.following++;
        users[0].followers++;
      });

    // firstUser -- follows --> user 1
    await request(app)
      .post(`/api/users/${users[1]._id}/follow`)
      .set('Authorization', firstUser.jwtToken)
      .then(({ body }) => {
        expect(body.data.follower).toBe(firstUser._id);
        firstUser.following++;
        users[0].followers++;
      });

    // user 0 -- follows --> firstUser
    await request(app)
      .post(`/api/users/${firstUser._id}/follow`)
      .set('Authorization', users[0].jwtToken)
      .then(({ body }) => {
        expect(body.data.follower).toBe(users[0]._id);
        firstUser.followers++;
        users[0].following++;
      });

    // user 0 -- follows --> user 1
    await request(app)
      .post(`/api/users/${users[1]._id}/follow`)
      .set('Authorization', users[0].jwtToken)
      .then(({ body }) => {
        expect(body.data.follower).toBe(users[0]._id);
        firstUser.followers++;
        users[0].following++;
      });
  });

  it('should block a user', async () => {
    return request(app)
      .post('/api/block')
      .set('Authorization', firstUser.jwtToken)
      .send({ targetUser: users[0]._id })
      .expect(httpStatus.CREATED)
      .then(({ body }) => {
        expect(body.data.targetUser).toBe(users[0]._id);
        expect(Object.keys(body.data).sort()).toEqual(blockFields.sort());
      });
  });

  it('should NOT block myself', async () => {
    return request(app)
      .post('/api/block')
      .set('Authorization', firstUser.jwtToken)
      .send({ targetUser: firstUser._id })
      .expect(httpStatus.BAD_REQUEST)
      .then(({ body }) => {
        expect(body.message).toBe('Cannot block yourself');
      });
  });

  it('should NOT block an missing user', async () => {
    return request(app)
      .post('/api/block')
      .set('Authorization', firstUser.jwtToken)
      .send({ targetUser: '5afc66be741c953ef07a618a' })
      .expect(httpStatus.NOT_FOUND)
      .then(({ body }) => {
        expect(body.message).toBe('User not found');
      });
  });

  it('should get the firstUser`s feed without the user 0`s item', async () => {
    return request(app)
      .get('/api/feed/flat')
      .set('Authorization', firstUser.jwtToken)
      .expect(httpStatus.OK)
      .then(({ body }) => {
        expect(body.data[0].uuid).toBe(users[1].productUuid);
        expect(body.data).toHaveLength(1);
      });
  });

  it('should get the user 0`s feed without the firstUser`s item', async () => {
    return request(app)
      .get('/api/feed/flat')
      .set('Authorization', users[0].jwtToken)
      .expect(httpStatus.OK)
      .then(({ body }) => {
        expect(body.data[0].uuid).toBe(users[1].productUuid);
        expect(body.data).toHaveLength(1);
      });
  });
});
