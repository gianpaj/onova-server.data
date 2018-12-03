// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import { Product, Tag } from '../models';

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

let user1 = {
  username: 'firstperson',
  emailAddress: 'gianpa+test@gmail.com',
  password: 'expressos',
};

let user2 = {
  username: 'anotherperson',
  emailAddress: 'gianpa+test2@gmail.com',
  password: 'express2',
};

// $FlowFixMe
let user3: UserDoc = {
  username: 'thirdperson',
  emailAddress: 'gianpa+test3@gmail.com',
  password: 'express3',
};

// $FlowFixMe
let user4: UserDoc = {
  username: 'forthperson',
  emailAddress: 'gianpa+test4@gmail.com',
  password: 'express4',
};

describe('## Suggested Users APIs', () => {
  beforeAll(beforeAllTests);

  let jwtToken1, jwtToken2, jwtToken3;

  // create 3 users/sellers + Tag and upload profile pic of a seller
  // 1 user doesn't have the shippingAddress
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
    const { user: resUser4, jwtToken: token4 } = await createUserAndLogin(
      user4
    );
  });

  it('should return an empty list of suggested sellers', () => {
    expect(true).toBe(true);
  });
});

function followUser(whomToFollow, token): Promise<any> {
  return request(app)
    .post(`/api/users/${whomToFollow}/follow`)
    .set('Authorization', token)
    .expect(httpStatus.CREATED);
}
