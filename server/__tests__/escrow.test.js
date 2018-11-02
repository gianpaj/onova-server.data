// @flow

import httpStatus from 'http-status';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import path from 'path';
import request from 'supertest';

import { agenda } from '../config/express';
import config from '../config/config';

import app from '../index';

import Order from '../models/order.model';

import {
  beforeAllTests,
  createOrder,
  createProduct,
  createUserAndLogin,
} from './utils';
import {
  buyerNeedsToPay,
  buyerPaidDeal,
  buyerPaymentFailure,
  sellerCancelsAPaidDeal,
  sellerConfirmedResponse,
  dealConfirmationResp,
} from '../helpers/shipping';

const photos = {
  photos: [
    'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
  ],
};

// This sets the mock adapter on the default instance
const mock = new MockAdapter(axios);

describe('## Escrow Manager', () => {
  beforeAll(beforeAllTests);

  let user1 = {
    username: 'userone',
    emailAddress: 'userone@gmail.com',
    password: 'expressos',
  };

  let user2 = {
    username: 'usertwo',
    emailAddress: 'usertwo@gmail.com',
    password: 'expressos',
  };

  let user3 = {
    username: 'userthree',
    emailAddress: 'userthree@gmail.com',
    password: 'expressos',
  };

  let productA = {
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    description: 'A - nice boots',
    price: '100.99',
    ...photos,
  };

  let user1ProductUuidA;
  let user1JwtToken, user2JwtToken, user3JwtToken;

  // create 3 users
  // create 1 products
  beforeAll(async () => {
    try {
      const { user: u1, jwtToken: j1 } = await createUserAndLogin(user1);
      user1JwtToken = j1;
      user1 = u1._id;
      const { user: u2, jwtToken: j2 } = await createUserAndLogin(user2);
      user2JwtToken = j2;
      user2 = u2._id;
      const { user: u3, jwtToken: j3 } = await createUserAndLogin(user3);
      user3JwtToken = j3;
      user3 = u3._id;
      const p1 = await createProduct(productA, user1JwtToken);
      user1ProductUuidA = p1.uuid;
    } catch (error) {
      console.error(error);
    }
  });

  describe('Product reservation and order cancellation', () => {
    // beforeEach(() => {
    //   return Order.collection.deleteMany({}, { safe: true });
    // });

    it('should reserve a product and put back forsale', async done => {
      try {
        const o = await createOrder(
          { ...productA, uuid: user1ProductUuidA },
          user2JwtToken
        );

        const { body } = await request(app)
          .post('/api/orders')
          .set('Authorization', user3JwtToken)
          .send({ product: user1ProductUuidA })
          .expect(httpStatus.BAD_REQUEST);

        expect(body.message).toBe(
          'This product is not longer for sale or is reserved.'
        );
        setTimeout(async () => {
          const { body: product } = await request(app)
            .get(`/api/products/${user1ProductUuidA}`)
            .set('Authorization', user3JwtToken)
            .expect(httpStatus.OK);
          expect(product.data.status).toBe('forsale');
          expect(product.data.datePending).toBe(undefined);

          const { body: orderFound } = await request(app)
            .get(`/api/orders/${o.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          expect(orderFound.data.status).toBe('cancelled');
          expect(typeof orderFound.data.dateCancelled).toBe('string');

          done();
        }, 4000);
      } catch (error) {
        console.error(error);
      }
    });
  });
});
