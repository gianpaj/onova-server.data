// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

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
    username: 'user1',
    emailAddress: 'gianpa+test@gmail.com',
    password: 'expressos',
  },
  {
    username: 'user2',
    emailAddress: 'gianpa+test2@gmail.com',
    password: 'express2',
  },
];

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

    await Promise.all([
      followUser(users[0].token, users[1]._id),
      followUser(users[1].token, users[0]._id),
    ]);

    /**
     * | from  |            | target |
     * | ----- | ---------- | ------ |
     * | user0 | follows -> | user1  |
     * | user1 | follows -> | user0  |
     */
  });

  it("should get an empty list if my followers haven't posted anything", () => {
    return request(app)
      .get('/api/feed/drops')
      .set('Authorization', users[0].token)
      .expect(httpStatus.OK)
      .then(({ body }) => expect(body.data).toHaveLength(0));
  });
});
