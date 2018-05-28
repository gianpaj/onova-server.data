// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import Follow from '../models/follow.model';
import User from '../models/user.model';
import Report from '../models/report.model';
import Verification from '../models/verification.model';
import { createUserAndLogin, createProduct } from './utils';

const reportFields = ['createdAt', '_id', 'text', 'reporter'];

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

describe('## Report methods', () => {
  beforeAll(done => {
    const collections = [
      User.collection,
      Report.collection,
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

    const { user, jwtToken } = await createUserAndLogin(firstPerson);
    firstPerson._id = user._id;
    firstPerson.jwtToken = jwtToken;

    const p1 = await createProduct(product, jwtToken);
    const product2 = { ...product };
    product.uuid = p1.uuid;
    try {
      const p2 = await createProduct(product2, users[0].jwtToken);
      users[0].uuid = p2.uuid;
    } catch (err) {
      console.error(err);
    }
  });

  it('should report a user', async () => {
    return request(app)
      .post('/api/report')
      .set('Authorization', firstPerson.jwtToken)
      .send({ user: users[0]._id, text: 'they are a bad user' })
      .expect(httpStatus.CREATED)
      .then(({ body }) => {
        expect(body.data.text).toBe('they are a bad user');
        expect(Object.keys(body.data).sort()).toEqual(
          [...reportFields, 'user'].sort()
        );
      });
  });

  it('should NOT report myself', async () => {
    return request(app)
      .post('/api/report')
      .set('Authorization', firstPerson.jwtToken)
      .send({ user: firstPerson._id, text: 'i am bad boy' })
      .expect(httpStatus.BAD_REQUEST)
      .then(({ body }) => {
        expect(body.message).toBe('Cannot report yourself');
      });
  });

  it('should report a user OR a product', async () => {
    return request(app)
      .post('/api/report')
      .set('Authorization', firstPerson.jwtToken)
      .send({ text: 'everything is terrible' })
      .expect(httpStatus.BAD_REQUEST)
      .then(({ body }) => {
        expect(body.message).toBe('Report a user or product');
      });
  });

  it('should report a product', async () => {
    return request(app)
      .post('/api/report')
      .set('Authorization', firstPerson.jwtToken)
      .send({ product: users[0].uuid, text: 'bad product' })
      .expect(httpStatus.CREATED)
      .then(({ body }) => {
        expect(body.data.text).toBe('bad product');
        expect(Object.keys(body.data).sort()).toEqual(
          [...reportFields, 'product'].sort()
        );
      });
  });

  it('should NOT report my product', async () => {
    return request(app)
      .post('/api/report')
      .set('Authorization', firstPerson.jwtToken)
      .send({ product: product.uuid, text: 'bad product' })
      .expect(httpStatus.BAD_REQUEST)
      .then(({ body }) => {
        expect(body.message).toBe('Cannot report your product');
      });
  });
});
