// @flow

import httpStatus from 'http-status';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import request from 'supertest';

import { agenda } from '../../config/express';
import config from '../../config/config';

import app from '../../index';

import Order from '../../models/order.model';
import Product from '../../models/product.model';

import { NP } from '../../helpers/shipping';

import {
  beforeAllTests,
  createOrder,
  createProduct,
  createUserAndLogin,
} from '../utils';
import {
  buyerNeedsToPay,
  buyerPaidDeal,
  dealConfirmationResp,
  sellerConfirmedResponse,
  novaPoshta,
} from '../../helpers/shipping';

const photos = {
  photos: [
    'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
  ],
};

jest.setTimeout(10000);

// This sets the mock adapter on the default instance
const mock = new MockAdapter(axios);

describe('## Shipping Runner', () => {
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
    price: '190.99',
    ...photos,
  };

  let user1ProductUuidA, user1ProductUuidA2;
  let user1JwtToken, user2JwtToken, user3JwtToken;

  // create 3 users
  beforeAll(async () => {
    try {
      const { user: u1, jwtToken: j1 } = await createUserAndLogin(user1);
      user1JwtToken = j1;
      user1._id = u1._id;
      const { user: u2, jwtToken: j2 } = await createUserAndLogin(user2);
      user2JwtToken = j2;
      user2._id = u2._id;
      const { user: u3, jwtToken: j3 } = await createUserAndLogin(user3);
      user3JwtToken = j3;
      user3._id = u3._id;
    } catch (error) {
      console.error(error);
    }
  });

  describe('Check shipping status from generated to shipped', () => {
    let o1;
    // clear Product and Orders
    // create 2 products
    beforeEach(async () => {
      await Product.collection.deleteMany({}, { safe: true });
      await Order.collection.deleteMany({}, { safe: true });
      try {
        const p1 = await createProduct(productA, user1JwtToken);
        user1ProductUuidA = p1.uuid;
        const p2 = await createProduct(productA, user1JwtToken);
        user1ProductUuidA2 = p2.uuid;
        o1 = await createOrder(
          { ...productA, uuid: user1ProductUuidA },
          user2JwtToken
        );
      } catch (error) {
        console.error(error);
      }
    });

    it('should have checked an order has been shipped', async done => {
      try {
        const dealID = '1B27M6E';
        await payOrder(o1.id, user2JwtToken, dealID);
        // seller needs to ships after confirming
        mock
          .onPost(`/deals/${dealID}/confirmations`)
          .reply(200, dealConfirmationResp);
        mock.onGet(`/deals/${dealID}`).reply(200, sellerConfirmedResponse);
        await request(app)
          .put(`/api/orders/${o1.id}`)
          .set('Authorization', user1JwtToken)
          .send({ status: 'confirmed' })
          .expect(httpStatus.OK)
          .then(res => {
            const o = res.body.data;
            expect(o.status).toBe('confirmed');
            expect(o.transactionStatus).toBe('ua-finished');
            expect(o.transactionId).toBe(dealID);
            expect(o.trackingNumber).toBe(
              sellerConfirmedResponse.data.handler.waybillNumber.toString()
            );
            expect(typeof o.dateConfirmed).toBe('string');
          });

        mock
          .onPost('https://api.novaposhta.ua/v2.0/json/documentsTracking/')
          .reply(200, novaPoshta.shipped);

        // test system message has been scheduled
        setTimeout(async () => {
          const {
            body: { data: orderFound1 },
          } = await request(app)
            .get(`/api/orders/${o1.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          console.log(orderFound1);

          // test order is now 'shipped'
          expect(orderFound1.shippingStatus).toBe(NP.shipped);

          // agenda.jobs({ name: 'config.JOBNAMES.PUSH_ORDER' }, (err, jobs) => {
          //   if (err) return done(err);
          //   expect(jobs).toHaveLength(3);
          //   const targetUsers = jobs
          //     .map(j => j.attrs)
          //     .map(({ data }) => data.targetUser.toString())
          //     .slice(1); // remove the first push notification job

          //   expect(targetUsers.find(u => u === buyer._id)).toBeTruthy();
          //   expect(targetUsers.find(u => u === seller._id)).toBeTruthy();

          //   const { data: push1 } = jobs.map(j => j.attrs)[1];
          //   expect(push1.triggeredBy.toString()).toBe(o.id);
          //   expect(push1.triggeredType).toBe('Order');
          //   expect(typeof push1.random).toBe('string');
          //   const { data: push2 } = jobs.map(j => j.attrs)[2];
          //   expect(push2.triggeredBy.toString()).toBe(o.id);
          //   expect(push2.triggeredType).toBe('Order');
          //   expect(typeof push2.random).toBe('string');

          //   agenda.jobs(
          //     { name: config.JOBNAMES.PUSH_ORDER_CONFIRM_REMINDER },
          //     (err, jobs) => {
          //       if (err) return done(err);
          //       expect(jobs).toHaveLength(1);
          //       done();
          //     }
          //   );
          // });

          done();
        }, 7000);
      } catch (error) {
        console.error(error);
      }
    });
  });
});

async function payOrder(orderId: string, buyerJWTToken, dealID) {
  mock.onPost('/carts').reply(200, { data: { id: 577, deals: [] } });
  mock.onPost('/deals').reply(200, { data: { id: dealID } });
  mock.onPost(`/deals/${dealID}/payments`).reply(200);
  mock.onGet(`/deals/${dealID}`).reply(200, buyerNeedsToPay);
  await request(app)
    .post(`/api/orders/${orderId}/pay`)
    .set('Authorization', buyerJWTToken)
    .send({ cvc: '123' })
    .expect(httpStatus.CREATED)
    .then(({ body }) => {
      expect(body.data.payment.redirectUrl).toContain(
        '.uapay.ua/api/payments/'
      );
      expect(body.data.payment.PaReq.length).toBeGreaterThan(400);
    });

  mock.onGet(`/deals/${dealID}`).reply(200, buyerPaidDeal);
  return request(app)
    .get(`/api/orders/${orderId}/paymentStatus`)
    .set('Authorization', buyerJWTToken)
    .expect(httpStatus.OK)
    .then(({ body }) => {
      expect(body.data.status).toBe('ua-finished');
      expect(body.data.rawStatus).toBe('FINISHED');
    });
}
