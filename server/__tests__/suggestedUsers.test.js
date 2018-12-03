// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import { Tag, UserDoc } from '../models';

import app from '../index';
import {
  beforeAllTests,
  createComment,
  createProduct,
  createUserAndLogin,
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
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    password: 'expressos',
  },
  {
    username: 'anotherperson',
    emailAddress: 'gianpa+test2@gmail.com',
    password: 'express2',
  },

  {
    username: 'thirdperson',
    emailAddress: 'gianpa+test3@gmail.com',
    password: 'express3',
  },
  {
    username: 'forthperson',
    emailAddress: 'gianpa+test4@gmail.com',
    password: 'express4',
  },
];

describe('## Suggested Users APIs', () => {
  beforeAll(beforeAllTests);

  // let users: Array<{ _id: MongoId, token: string }>;

  // create 4 users and follow
  beforeAll(async () => {
    const usersAndTokens = await Promise.all(users.map(createUserAndLogin));
    users = usersAndTokens.map(user => ({
      ...user.user,
      token: user.jwtToken,
    }));

    await Promise.all([
      followUser(users[0].token, users[1]._id),
      followUser(users[0].token, users[2]._id),
      followUser(users[0].token, users[3]._id),
      followUser(users[1].token, users[2]._id),
      followUser(users[1].token, users[3]._id),
      followUser(users[2].token, users[3]._id),
    ]);

    /**
     * | from  |            | target |
     * | ----- | ---------- | ------ |
     * | user0 | follows -> | user1  |
     * | user0 | follows -> | user2  |
     * | user0 | follows -> | user3  |
     * | user1 | follows -> | user2  |
     * | user1 | follows -> | user3  |
     * | user3 | follows -> | user4  |
     */
  });

  it('should return an empty list of suggested sellers', () => {
    return request(app)
      .get('/api/suggested-users/')
      .set('Authorization', users[0].token)
      .expect(httpStatus.OK)
      .then(({ body }) => {
        expect(body.data).toHaveLength(0);
        expect(body.new).toBe(false);
      });
  });
});

function followUser(token, whomToFollow): Promise<any> {
  return request(app)
    .post(`/api/users/${whomToFollow}/follow`)
    .set('Authorization', token)
    .expect(httpStatus.CREATED);
}
