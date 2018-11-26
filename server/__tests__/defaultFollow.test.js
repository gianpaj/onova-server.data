// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';
const debug = require('debug')('server-data:index');

import app from '../index';
import { DefaultFollow } from '../models';
import { beforeAllTests, createUserAndLogin } from './utils';

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

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

describe.skip('## Default Follow methods', () => {
  beforeAll(beforeAllTests);

  let firstPerson = {
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    password: 'expressos',
  };

  let defaultSellers = [
    {
      username: 'seller1',
      emailAddress: 'gianpa+seller1@gmail.com',
      password: 'express2',
    },
    {
      username: 'seller2',
      emailAddress: 'gianpa+seller2@gmail.com',
      password: 'express2',
    },
    {
      username: 'seller3',
      emailAddress: 'gianpa+seller3@gmail.com',
      password: 'express2',
    },
    {
      username: 'seller4',
      emailAddress: 'gianpa+seller4@gmail.com',
      password: 'express2',
    },
    {
      username: 'seller5',
      emailAddress: 'gianpa+seller5@gmail.com',
      password: 'express2',
    },
  ];

  // create 6 users/sellers
  beforeAll(async () => {
    for (let i = 0; i < defaultSellers.length; i++) {
      const { user, jwtToken } = await createUserAndLogin(defaultSellers[i]);
      defaultSellers[i]._id = user._id;
      defaultSellers[i].jwtToken = jwtToken;

      await DefaultFollow.create({ user: defaultSellers[i]._id });
      debug('default user created:', defaultSellers[i].username);
    }

    const { user, jwtToken } = await createUserAndLogin(firstPerson);
    firstPerson._id = user._id;
    firstPerson.jwtToken = jwtToken;
  });

  it('should follow 5 users after an account is created', async () => {
    // wait for async Auto following (followDefaultUsers)
    await sleep(100);
    return request(app)
      .get(`/api/users/${firstPerson._id}`)
      .expect(httpStatus.OK)
      .then(res => {
        expect(res.body.username).toBe(firstPerson.username);
        expect(res.body.emailAddress).toBe(firstPerson.emailAddress);
        expect(res.body.followersCount).toBe(0);
        expect(res.body.followingCount).toBe(5);
      });
  });
});
