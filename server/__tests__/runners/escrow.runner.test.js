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

import {
  beforeAllTests,
  createOrder,
  createProduct,
  createUserAndLogin,
} from '../utils';
import {
  buyerNeedsToPay,
  buyerPaidDeal,
  sellerCancelsAPaidDeal,
  sellerConfirmedResponse,
} from '../../helpers/shipping';

const photos = {
  photos: [
    'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
  ],
};

jest.setTimeout(10000);

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

  describe('Product reservation and order cancellation', () => {
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
      } catch (error) {
        console.error(error);
      }
    });

    it('should reserve a product and put back forsale', async done => {
      try {
        const o = await createOrder(
          { ...productA, uuid: user1ProductUuidA },
          user2JwtToken
        );
        const o2 = await createOrder(
          { ...productA, uuid: user1ProductUuidA2 },
          user2JwtToken
        );

        const { body } = await request(app)
          .post('/api/orders')
          .set('Authorization', user3JwtToken)
          .send({ product: user1ProductUuidA })
          .expect(httpStatus.BAD_REQUEST);

        // put the 2nd order 10 minutes back
        await Order.updateOne(
          { _id: o2.id },
          { $set: { datePending: new Date(Date.now() - 10 * 60 * 1000) } }
        );

        expect(body.message).toBe(
          'This product is not longer for sale or is reserved.'
        );
        setTimeout(async () => {
          const { body: product } = await request(app)
            .get(`/api/products/${user1ProductUuidA}`)
            .set('Authorization', user3JwtToken)
            .expect(httpStatus.OK);
          expect(product.data.status).toBe('reserved');
          // expect(product.data.datePending).toBeInstanceOf(Date);

          const { body: product2 } = await request(app)
            .get(`/api/products/${user1ProductUuidA2}`)
            .set('Authorization', user3JwtToken)
            .expect(httpStatus.OK);
          expect(product2.data.status).toBe('forsale');
          expect(product2.data.datePending).toBe(undefined);

          const { body: orderFound1 } = await request(app)
            .get(`/api/orders/${o.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          expect(orderFound1.data.status).toBe('pending');
          expect(typeof orderFound1.data.datePending).toBe('string');

          const { body: orderFound2 } = await request(app)
            .get(`/api/orders/${o2.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          expect(orderFound2.data.status).toBe('cancelled');
          expect(typeof orderFound2.data.dateCancelled).toBe('string');

          done();
        }, 4000);
      } catch (error) {
        console.error(error);
      }
    });

    it("should cancel an order after the seller didn't confirm", async done => {
      const buyer = { ...user2, jwtToken: user2JwtToken };
      const seller = {
        ...user1,
        jwtToken: user1JwtToken,
        productUUID: user1ProductUuidA,
      };

      try {
        const o = await createOrder(
          { ...productA, uuid: seller.productUUID },
          buyer.jwtToken
        );
        const dealID = '9B27M6E';

        // put the order payment 10 minutes back
        await Order.updateOne(
          { _id: o.id },
          { $set: { datePaid: new Date(Date.now() - 10 * 60 * 1000) } }
        );

        // buyer starts payment
        mock.onPost('/carts').reply(200, { data: { id: 574, deals: [] } });
        mock.onPost('/deals').reply(200, { data: { id: dealID } });
        mock.onPost(`/deals/${dealID}/payments`).reply(200);
        mock.onGet(`/deals/${dealID}`).reply(200, buyerNeedsToPay);
        const { body: payment } = await request(app)
          .post(`/api/orders/${o.id}/pay`)
          .set('Authorization', buyer.jwtToken)
          .send({ cvc: '123' })
          .expect(httpStatus.CREATED);
        expect(payment.data.order).toBeTruthy();
        expect(payment.data.payment.redirectUrl).toContain(
          '.uapay.ua/api/payments/'
        );
        expect(payment.data.payment.PaReq.length).toBeGreaterThan(400);

        // buyer completes payment
        mock.onGet(`/deals/${dealID}`).reply(200, buyerPaidDeal);
        await request(app)
          .get(`/api/orders/${o.id}/paymentStatus`)
          .set('Authorization', buyer.jwtToken)
          .expect(httpStatus.OK)
          .then(({ body }) => {
            expect(body.data.status).toBe('ua-finished');
            expect(body.data.rawStatus).toBe('FINISHED');
          });

        mock
          .onPost(`/deals/${dealID}/rejections`)
          .reply(200, sellerCancelsAPaidDeal);

        setTimeout(async () => {
          const { body: product } = await request(app)
            .get(`/api/products/${seller.productUUID}`)
            .set('Authorization', user3JwtToken)
            .expect(httpStatus.OK);
          expect(product.data.status).toBe('forsale');
          expect(product.data.datePending).toBe(undefined);

          const { body: orderFound } = await request(app)
            .get(`/api/orders/${o.id}`)
            .set('Authorization', buyer.jwtToken)
            .expect(httpStatus.OK);

          expect(orderFound.data.status).toBe('failed_by_seller');
          expect(orderFound.data.transactionStatus).toBe('ua-reversed');
          expect(typeof orderFound.data.dateFailed).toBe('string');

          agenda.jobs({ name: config.JOBNAMES.PUSH_ORDER }, (err, jobs) => {
            if (err) return done(err);
            expect(jobs).toHaveLength(3);
            const targetUsers = jobs
              .map(j => j.attrs)
              .map(({ data }) => data.targetUser.toString())
              .slice(1); // remove the first push notification job

            expect(targetUsers.find(u => u === buyer._id)).toBeTruthy();
            expect(targetUsers.find(u => u === seller._id)).toBeTruthy();

            const { data: push1 } = jobs.map(j => j.attrs)[1];
            expect(push1.triggeredBy.toString()).toBe(o.id);
            expect(push1.triggeredType).toBe('Order');
            expect(typeof push1.random).toBe('string');
            const { data: push2 } = jobs.map(j => j.attrs)[2];
            expect(push2.triggeredBy.toString()).toBe(o.id);
            expect(push2.triggeredType).toBe('Order');
            expect(typeof push2.random).toBe('string');

            agenda.jobs(
              { name: config.JOBNAMES.PUSH_ORDER_CONFIRM_REMINDER },
              (err, jobs) => {
                if (err) return done(err);
                expect(jobs).toHaveLength(1);
                done();
              }
            );
          });
        }, 4000);
      } catch (error) {
        console.error(error);
      }
    });

    it("should NOT cancel an order after the seller didn't confirm", async done => {
      const buyer = { ...user2, jwtToken: user2JwtToken };
      const seller = {
        ...user1,
        jwtToken: user1JwtToken,
        productUUID: user1ProductUuidA,
      };

      try {
        const o = await createOrder(
          { ...productA, uuid: seller.productUUID },
          buyer.jwtToken
        );
        const dealID = '9B27M6E';

        // buyer starts payment
        mock.onPost('/carts').reply(200, { data: { id: 574, deals: [] } });
        mock.onPost('/deals').reply(200, { data: { id: dealID } });
        mock.onPost(`/deals/${dealID}/payments`).reply(200);
        mock.onGet(`/deals/${dealID}`).reply(200, buyerNeedsToPay);
        const { body: payment } = await request(app)
          .post(`/api/orders/${o.id}/pay`)
          .set('Authorization', buyer.jwtToken)
          .send({ cvc: '123' })
          .expect(httpStatus.CREATED);
        expect(payment.data.order).toBeTruthy();
        expect(payment.data.payment.redirectUrl).toContain(
          '.uapay.ua/api/payments/'
        );
        expect(payment.data.payment.PaReq.length).toBeGreaterThan(400);

        // buyer completes payment
        mock.onGet(`/deals/${dealID}`).reply(200, buyerPaidDeal);
        await request(app)
          .get(`/api/orders/${o.id}/paymentStatus`)
          .set('Authorization', buyer.jwtToken)
          .expect(httpStatus.OK)
          .then(({ body }) => {
            expect(body.data.status).toBe('ua-finished');
            expect(body.data.rawStatus).toBe('FINISHED');
          });

        mock
          .onPost(`/deals/${dealID}/rejections`)
          .reply(200, sellerCancelsAPaidDeal);

        setTimeout(async () => {
          const { body: product } = await request(app)
            .get(`/api/products/${seller.productUUID}`)
            .set('Authorization', user3JwtToken)
            .expect(httpStatus.OK);

          expect(product.data.status).toBe('reserved');
          expect(typeof product.data.reservedDate).toBe('string');

          const { body: orderFound } = await request(app)
            .get(`/api/orders/${o.id}`)
            .set('Authorization', buyer.jwtToken)
            .expect(httpStatus.OK);

          expect(orderFound.data.status).toBe('paid');
          expect(orderFound.data.transactionStatus).toBe('ua-finished');
          expect(typeof orderFound.data.datePaid).toBe('string');

          done();
        }, 4000);
      } catch (error) {
        console.error(error);
      }
    });
  });
});
