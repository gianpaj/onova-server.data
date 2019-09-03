import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';
// import superagent from 'superagent';
// import mockSuperagent from 'superagent-mock';

import app from '../../index';
import config from '../../config/config';
import { beforeAllTests, clearJobs, closeDBConnection, createUserAndLogin, findJobs } from '../utils';

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

jest.setTimeout(10000);

// const instagramEndPoint = 'https://www.instagram.com/';
// const instagramPostEndPoint = 'https://www.instagram.com/p/';
// let superagentMock, instagramParams;

describe('## Instagram Runner', () => {
  beforeAll(beforeAllTests);

  // beforeAll(() => {
  //   superagentMock = mockSuperagent(superagent, [
  //     {
  //       pattern: instagramEndPoint,
  //       fixtures: (match, params) => {
  //         instagramParams = params;
  //         return {};
  //       },
  //       get: (match, data) => ({ body: data }),
  //     },
  //   ]);
  // });

  let user1 = {
    username: 'userone',
    emailAddress: 'userone@gmail.com',
    password: 'expressos',
  };

  const bio = 'Авторський крій, геометричні форми, апелювання до японських дизайнерів.';
  let user1JwtToken;

  // afterAll(() => {
  //   superagentMock.unset();
  // });

  describe('Scrape Instagram and create Product', () => {
    // create a user and set bio in order to set the socials
    beforeAll(async () => {
      const { user: u1, jwtToken: j1 } = await createUserAndLogin(user1);
      user1JwtToken = j1;
      user1._id = u1._id;

      return request(app)
        .put(`/api/users/${user1._id}`)
        .set('Authorization', user1JwtToken)
        .send({ instagram: 'horondi' })
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.scraping.instagram).toBe('horondi'));
    });
    // beforeEach(async () => {
    //   try {
    //     await Product.collection.deleteMany({}, { safe: true });
    //     await clearJobs();
    //   } catch (error) {
    //     console.error(error);
    //   }
    // });
    // afterEach(() => closeDBConnection());

    it('should created a Drop and a product', async done => {
      try {
        const waitFor = 15 * 1000; // seconds
        const interval = Math.floor(waitFor / 100);
        let totalTime = interval;

        // test a system message has been scheduled saying that the order has been confirmed
        // Check every 150ms for up to 15 seconds
        const timer = setInterval(async () => {
          totalTime += interval;

          // const emailMsg = instagramParams.Messages[0];
          // mock.onGet(`/_username_`).reply(200, { /* IG user profile */});

          const {
            body: { data: products },
          } = await request(app)
            .get('/api/products/')
            .expect(httpStatus.OK);

          if (products.length) {
            expect(products).toHaveLength(1);

            // GET User products

            // expect(products[0].description.startsWith(i18n.orderConfirmed.slice(0, 10))).toBe(true);
            done();
            clearInterval(timer);
            return;
          }

          // it should not send a second confirmation system message - test this by using a long setTimeout

          if (totalTime >= waitFor) {
            clearInterval(timer);
            throw new Error('timeout to scrape IG');
          }
        }, interval);
      } catch (error) {
        console.error(error);
        done(error);
      }
    });
  });
});
