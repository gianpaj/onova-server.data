// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import Follow from '../models/follow.model';
import User from '../models/user.model';
import Block from '../models/block.model';
import Verification from '../models/verification.model';
import { createUserAndLogin } from './utils';

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

  let firstPerson = {
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    password: 'expressos',
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

    const { user, jwtToken } = await createUserAndLogin(firstPerson);
    firstPerson._id = user._id;
    firstPerson.jwtToken = jwtToken;
  });

  it('should block a user', async () => {
    return request(app)
      .post('/api/block')
      .set('Authorization', firstPerson.jwtToken)
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
      .set('Authorization', firstPerson.jwtToken)
      .send({ targetUser: firstPerson._id })
      .expect(httpStatus.BAD_REQUEST)
      .then(({ body }) => {
        expect(body.message).toBe('Cannot block yourself');
      });
  });

  it('should NOT block an missing user', async () => {
    return request(app)
      .post('/api/block')
      .set('Authorization', firstPerson.jwtToken)
      .send({ targetUser: '5afc66be741c953ef07a618a' })
      .expect(httpStatus.NOT_FOUND)
      .then(({ body }) => {
        expect(body.message).toBe('User not found');
      });
  });
});
