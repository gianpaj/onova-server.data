// @flow

import httpStatus from 'http-status';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import request from 'supertest';
const { MongoClient } = require('mongodb');

import { agenda } from '../../config/express';
import config from '../../config/config';

import app from '../../index';

import { i18n } from '../../controllers/order.controller';
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

let mongoClient = null;

function clearJobs() {
  return new Promise((resolve, reject) => {
    const jobDb = `mongodb://${config.mongo.host}:${config.mongo.port}/${
      config.mongo.jobDb
    }`;
    MongoClient.connect(
      jobDb,
      (err, client) => {
        mongoClient = client;
        const mongoDb = client.db(config.mongo.jobDb);
        mongoDb
          .collection('agendaJobs')
          .deleteMany({})
          .then(res => {
            // console.log(res.deletedCount);
            resolve();
          });
        if (err) reject(err);
      }
    );
  });
}

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

  let productA = {
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    description: 'A - nice boots',
    price: '190.99',
    ...photos,
  };

  let user1JwtToken, user2JwtToken;

  // create 3 users
  beforeAll(async () => {
    try {
      const { user: u1, jwtToken: j1 } = await createUserAndLogin(user1);
      user1JwtToken = j1;
      user1._id = u1._id;
      const { user: u2, jwtToken: j2 } = await createUserAndLogin(user2);
      user2JwtToken = j2;
      user2._id = u2._id;
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
      await clearJobs();
      try {
        const { uuid } = await createProduct(productA, user1JwtToken);
        o1 = await createOrder({ ...productA, uuid }, user2JwtToken);
      } catch (error) {
        console.error(error);
      }
    });

    afterEach(() => {
      return new Promise(async resolve => {
        await mongoClient.close();
        return resolve();
      });
    });

    it.skip('should have checked an order tracking number has been generated', async done => {
      try {
        const dealID = '1B27M6E';
        await payOrder(o1.id, user2JwtToken, dealID);
        // seller needs to ships after confirming
        await confirmOrder(o1.id, user1JwtToken, dealID);

        mock
          .onPost('https://api.novaposhta.ua/v2.0/json/documentsTracking/')
          .reply(200, novaPoshta.generated);

        // test system message has been scheduled
        setTimeout(async () => {
          const {
            body: { data: orderFound1 },
          } = await request(app)
            .get(`/api/orders/${o1.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          expect(orderFound1.shippingStatus).toBe(NP.generated);
          expect(orderFound1.status).toBe('confirmed');

          agenda.jobs({ name: config.JOBNAMES.SYSTEM_MSG }, (err, jobs) => {
            if (err) return done(err);
            const data = jobs.map(job => job.attrs.data);
            expect(data).toHaveLength(1);
            // const job = jobs.find(job => job.attrs.data.order._id == o1.id);
            expect(
              data[0].message.endsWith(i18n.orderConfirmed.slice(-10))
            ).toBeTruthy();
            done();
          });
        }, 6000);
      } catch (error) {
        console.error(error);
      }
    });

    it.skip('should have checked an order has been shipped', async done => {
      try {
        const dealID = '1B27M6E';
        await payOrder(o1.id, user2JwtToken, dealID);
        // seller needs to ships after confirming
        await confirmOrder(o1.id, user1JwtToken, dealID);

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

          expect(orderFound1.shippingStatus).toBe(NP.shipped);
          expect(orderFound1.status).toBe('shipped');
          expect(typeof orderFound1.dateShipped).toBe('string');

          agenda.jobs({ name: config.JOBNAMES.SYSTEM_MSG }, (err, jobs) => {
            if (err) return done(err);
            const data = jobs.map(job => job.attrs.data);
            expect(data).toHaveLength(2);
            // const job = jobs.find(job => job.attrs.data.order._id == o1.id);
            data.map(data => {
              // expect(data.shippingStatus).toBe(NP.shipped);
              if (data.message.endsWith(i18n.orderShipped.slice(-10))) {
                done();
              }
            });
          });
        }, 6000);
      } catch (error) {
        console.error(error);
      }
    });

    it.skip('should have checked an order has been delivered', async done => {
      try {
        const dealID = '1B27M6E';
        await payOrder(o1.id, user2JwtToken, dealID);
        // seller needs to ships after confirming
        await confirmOrder(o1.id, user1JwtToken, dealID);

        mock
          .onPost('https://api.novaposhta.ua/v2.0/json/documentsTracking/')
          .reply(200, novaPoshta.delivered);

        // test system message has been scheduled
        setTimeout(async () => {
          const {
            body: { data: orderFound },
          } = await request(app)
            .get(`/api/orders/${o1.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          expect(orderFound.shippingStatus).toBe(NP.delivered);
          expect(orderFound.dateDelivered).toBe(
            new Date(
              novaPoshta.delivered.data[0].DateFirstDayStorage
            ).toISOString()
          );
          expect(orderFound.status).toBe('delivered');

          agenda.jobs({ name: config.JOBNAMES.SYSTEM_MSG }, (err, jobs) => {
            if (err) return done(err);
            const data = jobs.map(job => job.attrs.data);
            expect(data).toHaveLength(2);
            // const job = jobs.find(job => job.attrs.data.order._id == o1.id);
            data.map(data => {
              // expect(data.shippingStatus).toBe(NP.shipped);
              if (data.message.endsWith(i18n.orderDelivered.slice(-10))) {
                done();
              }
            });
          });
        }, 4000);
      } catch (error) {
        console.error(error);
      }
    });

    it.skip('should have checked an order has been collected', async done => {
      try {
        const dealID = '1B27M6E';
        await payOrder(o1.id, user2JwtToken, dealID);
        // seller needs to ships after confirming
        await confirmOrder(o1.id, user1JwtToken, dealID);

        mock
          .onPost('https://api.novaposhta.ua/v2.0/json/documentsTracking/')
          .reply(200, novaPoshta.collected);

        // test system message has been scheduled
        setTimeout(async () => {
          const {
            body: { data: orderFound },
          } = await request(app)
            .get(`/api/orders/${o1.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          expect(orderFound.shippingStatus).toBe(NP.collected);
          expect(orderFound.status).toBe('completed');
          expect(typeof orderFound.dateCompleted).toBe('string');

          agenda.jobs({ name: config.JOBNAMES.SYSTEM_MSG }, (err, jobs) => {
            if (err) return done(err);
            const data = jobs.map(job => job.attrs.data);
            expect(data).toHaveLength(2);
            // const job = jobs.find(job => job.attrs.data.order._id == o1.id);
            data.map(data => {
              // expect(data.shippingStatus).toBe(NP.shipped);
              if (data.message.endsWith(i18n.orderCompleted.slice(-10))) {
                done();
              }
            });
          });
        }, 6000);
      } catch (error) {
        console.error(error);
      }
    });

    it('should have checked an order for a shipment that has been refused', async done => {
      try {
        const dealID = '1B27M6E';
        await payOrder(o1.id, user2JwtToken, dealID);
        // seller needs to ships after confirming
        await confirmOrder(o1.id, user1JwtToken, dealID);

        mock
          .onPost('https://api.novaposhta.ua/v2.0/json/documentsTracking/')
          .reply(200, novaPoshta.refused);

        // test system message has been scheduled
        setTimeout(async () => {
          const {
            body: { data: orderFound },
          } = await request(app)
            .get(`/api/orders/${o1.id}`)
            .set('Authorization', user2JwtToken)
            .expect(httpStatus.OK);

          expect(orderFound.shippingStatus).toBe(NP.refused);
          expect(orderFound.status).toBe('failed_by_buyer');
          expect(typeof orderFound.dateFailed).toBe('string');

          agenda.jobs({ name: config.JOBNAMES.SYSTEM_MSG }, (err, jobs) => {
            if (err) return done(err);
            const data = jobs.map(job => job.attrs.data);
            expect(data).toHaveLength(2);
            data.map(data => {
              if (data.message.endsWith(i18n.refusedItem.slice(-10))) {
                done();
              }
            });
          });
        }, 6000);
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

async function confirmOrder(
  orderId: string,
  sellerJwtToken,
  dealID
): Promise<any> {
  mock
    .onPost(`/deals/${dealID}/confirmations`)
    .reply(200, dealConfirmationResp);
  mock.onGet(`/deals/${dealID}`).reply(200, sellerConfirmedResponse);
  return request(app)
    .put(`/api/orders/${orderId}`)
    .set('Authorization', sellerJwtToken)
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
}
