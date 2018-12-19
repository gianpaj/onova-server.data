// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import shortid from 'shortid';
import path from 'path';
import httpStatus from 'http-status';
import addDays from 'date-fns/add_days';

import { User, Drop, Product, Notification } from '../models';

import config from '../config/config';
import app from '../index';
import {
  beforeAllTests,
  clearJobs,
  createUserAndLogin,
  findJobs,
  followUser,
} from './utils';
import { i18n } from '../controllers/drop.controller';

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
type UserTestDoc = {
  _id: MongoId,
  token: string,
};

let users: Array<UserTestDoc> = [
  {
    username: 'user0',
    emailAddress: 'gianpa+test0@gmail.com',
    password: 'express0',
  },
  {
    username: 'user1',
    emailAddress: 'gianpa+test1@gmail.com',
    password: 'express1',
  },
  {
    username: 'user2',
    emailAddress: 'gianpa+test2@gmail.com',
    password: 'express2',
  },
  {
    username: 'user3',
    emailAddress: 'gianpa+test3@gmail.com',
    password: 'express3',
  },
];

const nonActiveUser = {
  username: 'thirdperson',
  emailAddress: 'gianpa+nonactive@gmail.com',
  password: 'expressos',
};

let nonActiveUserJwtToken;

const product = {
  categoryIds: [1, 2, 3],
  typeIds: [1, 2, 3],
  tags: ['winter', 'spring2007'], // optional
  description: 'nice boots',
  price: '1100.99',
  photos: ['http://storage.googleapis.com/1527232263107'],
};

describe('## Drops feed APIs', () => {
  beforeAll(beforeAllTests);

  // create 2 users and follow each other
  beforeAll(async () => {
    await clearJobs();

    const usersAndTokens = await Promise.all(users.map(createUserAndLogin));
    users = usersAndTokens.map(user => ({
      ...user.user,
      token: user.jwtToken,
    }));

    await Promise.all([
      request(app)
        .put(`/api/users/${users[2]._id}`)
        .set('Authorization', users[2].token)
        .send({ shippingAddress: {} })
        .expect(httpStatus.OK),
      request(app)
        .post('/api/users')
        .send(nonActiveUser)
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data.username).toBe(nonActiveUser.username);
          expect(body.data.emailAddress).toBe(nonActiveUser.emailAddress);
          expect(body.data.accountStatus).toBe('notverified');
          expect(typeof body.token).toBe('string');
          nonActiveUserJwtToken = body.token;
        }),
      User.updateOne({ _id: users[3]._id }, { $unset: { paymentInfo: '' } }),
    ]);

    /**
     * | from  |            | target |
     * | ----- | ---------- | ------ |
     * | user0 | follows -> | user1  |
     * | user1 | follows -> | user0  |
     */
    await Promise.all([
      followUser(users[0].token, users[1]._id),
      followUser(users[1].token, users[0]._id),
    ]);
  });

  it("should get an empty list if my followers haven't posted anything", () => {
    return request(app)
      .get('/api/feed/drops')
      .set('Authorization', users[0].token)
      .expect(httpStatus.OK)
      .then(({ body }) => expect(body.data).toHaveLength(0));
  });

  describe('# POST /api/v2/drop', () => {
    beforeAll(() => {
      return request(app)
        .post('/api/photos/upload')
        .set('Authorization', users[1].token)
        .attach('photo', path.join(__dirname, 'images/boots-larger.jpeg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data).toContain(
            'https://storage.googleapis.com/temp-uploads.onova.co/'
          );
          product.photos = [body.data];
        });
    });

    beforeEach(() =>
      Promise.all([Drop.deleteMany({}), Product.deleteMany({}), clearJobs()])
    );

    it('should NOT make a drop with a item price to low', () => {
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[1].token)
        .send({
          date: new Date(),
          products: [
            { ...product, price: (config.settings.minPrice - 10).toString() },
          ],
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain(
            'Invalid product price. The minimum price is'
          )
        );
    });

    it('should NOT create a drop with invalid item images', () => {
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[1].token)
        .send({
          date: new Date(),
          products: [{ ...product, photos: ['http://asdfasd'] }],
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toContain('Invalid photos'));
    });

    it(`should NOT create a drop if seller is not verified`, () => {
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', nonActiveUserJwtToken)
        .send({
          date: new Date(),
          products: [product],
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'Please verify your account before creating a drop'
          );
        });
    });

    it(`should NOT create a drop if seller doesn't have a shipping address`, () => {
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[2].token)
        .send({
          date: new Date(),
          products: [product],
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Please enter your shipping address')
        );
    });

    it(`should NOT create a drop if seller doesn't have a payment info`, () => {
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[3].token)
        .send({
          products: [product],
          date: new Date(),
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Please enter your payment info')
        );
    });

    it('should NOT create a drop in the past (previous day)', () => {
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[0].token)
        .send({
          date: new Date(+new Date() - 23 * 60 * 60 * 1000),
          products: [product],
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('must be larger than or equal')
        );
    });

    it('should NOT create a drop an item after 3 months from today', () => {
      return request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[0].token)
        .send({
          date: addDays(new Date(Date.now()), 91),
          products: [product],
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('Cannot create a drop 90 days')
        );
    });

    it('should create a drop immediately with one product', async () => {
      await request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[1].token)
        .send({
          date: new Date(),
          products: [product],
        })
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const d = body.data;
          expect(Object.keys(d).sort()).toMatchSnapshot();
          expect(d.posted).toBe(true);
          expect(d.products).toHaveLength(1);
          expect(d.seller).toHaveLength(24); // Object Id
          expect(!isNaN(Date.parse(d.createdAt))).toBe(true);
          expect(!isNaN(Date.parse(d.updatedAt))).toBe(true);
          expect(shortid.isValid(d.uuid)).toBe(true);
        });
      // check that the drop items have been posted
      return request(app)
        .get('/api/products/')
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(Array.isArray(body.data));
          expect(body.data).toHaveLength(1);
          expect(body.data[0].status).toBe('forsale');
        });
    });

    it('should schedule a drop with one product', async done => {
      const drop = await request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[1].token)
        .send({
          date: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now,
          products: [product],
        })
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const d = body.data;
          expect(Object.keys(d).sort()).toMatchSnapshot();
          expect(d.posted).toBe(false);
          expect(d.products).toHaveLength(1);
          expect(d.seller).toHaveLength(24); // Object Id
          expect(!isNaN(Date.parse(d.createdAt))).toBe(true);
          expect(!isNaN(Date.parse(d.updatedAt))).toBe(true);
          expect(shortid.isValid(d.uuid)).toBe(true);
          return d;
        });
      // check that the drop item is not listed
      await request(app)
        .get('/api/products/')
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(Array.isArray(body.data));
          expect(body.data).toHaveLength(0);
        });

      const waitFor = 15 * 1000; // seconds
      const interval = Math.floor(waitFor / 100);
      let totalTime = interval;

      // Check every 150ms for up to 15 seconds
      const timer = setInterval(async () => {
        totalTime += interval;

        // check the job has been scheduled
        const jobs = await findJobs(config.JOBNAMES.SCHEDULE, {
          'data.uuid': drop.uuid,
        });

        if (jobs.length) {
          expect(jobs).toHaveLength(1);
          done();
          clearInterval(timer);
          return;
        }

        if (totalTime >= waitFor) {
          clearInterval(timer);
          throw new Error('timeout');
        }
      }, interval);
    });

    it('should post a drop with one product', async done => {
      const drop = await request(app)
        .post('/api/v2/drop')
        .set('Authorization', users[1].token)
        .send({
          date: new Date(Date.now() + 4 * 1000), // 4 seconds from now,
          products: [product],
        })
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const d = body.data;
          expect(Object.keys(d).sort()).toMatchSnapshot();
          expect(d.posted).toBe(false);
          expect(d.products).toHaveLength(1);
          expect(d.seller).toHaveLength(24); // Object Id
          expect(!isNaN(Date.parse(d.createdAt))).toBe(true);
          expect(!isNaN(Date.parse(d.updatedAt))).toBe(true);
          expect(shortid.isValid(d.uuid)).toBe(true);
          return d;
        });
      // check that the drop item is not listed
      await request(app)
        .get('/api/products/')
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(Array.isArray(body.data));
          expect(body.data).toHaveLength(0);
        });

      const waitFor = 15 * 1000; // 15 seconds
      const interval = Math.floor(waitFor / 100);
      let totalTime = interval;

      // Check every 150ms for up to 15 seconds
      const timer = setInterval(async () => {
        totalTime += interval;

        // check the job has run
        const { body } = await request(app)
          .get('/api/products/')
          .expect(httpStatus.OK);

        const notif = await Notification.findOne({
          notifI18n: i18n.listedDrop,
        });

        if (body.data.length && notif) {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].dropId).toEqual(drop._id);

          // Check:
          // - a Notification has been created to the seller
          // - a Push notification has been scheduled to the seller
          const jobs = await findJobs(config.JOBNAMES.PUSH_DROP_LISTED);
          expect(jobs).toHaveLength(1);
          expect(jobs[0].message).toBe(i18n.listedDrop);

          done();
          clearInterval(timer);
          return;
        }
        if (totalTime >= waitFor) {
          clearInterval(timer);
          throw new Error('timeout');
        }
      }, interval);
    });

    // it('should notify the seller once for a number of items in one Drop', async done => {});
  });

  // describe('# GET /feed/drops', () => {

  // });
});
