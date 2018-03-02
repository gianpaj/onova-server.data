// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';
import config from '../config/config';
import Follow from '../models/follow.model';
import Tag from '../models/tag.model';
import User from '../models/user.model';
import Verification from '../models/verification.model';

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

// GET /api/feed/ should only return these fields
const feedFields = [
  '_id',
];

let product = {
  categoryIds: [1, 2, 3],
  typeIds: [1, 2, 3],
  tags: ['winter', 'spring2007'], // optional
  description: 'nice boots',
  // seller comes after the user is created
  price: '100.99', // if no decimal points .00 will be added
};

let anotherProduct = {
  categoryIds: [1],
  typeIds: [1, 3],
  description: 'nice jacket',
  price: '230.99',
};

let user = {
  username: 'firstperson',
  emailAddress: 'gianpa+test@gmail.com',
  mobileNumber: '1234567890', // optional
  password: 'expressos',
};

let anotherUser = {
  username: 'anotherperson',
  emailAddress: 'gianpa+test2@gmail.com',
  mobileNumber: '1234567890', // optional
  password: 'express2',
};

let thirdUser = {
  username: 'thirdwheel',
  emailAddress: 'gianpa+thirdwheel@gmail.com',
  password: 'express3',
};

let userId;
let anotherUserId;
let thirdUserId;
let jwtToken;
let anotherJwtToken;

describe('## Feed APIs', () => {
  beforeAll(done => {
    // mongoose.connection.dropDatabase().then(done);
    const collections = [
      Follow.collection,
      Tag.collection,
      User.collection,
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

  // create 2 users/sellers + 2 products
  beforeAll(done => {
    request(app)
      .post('/api/users')
      .send(user)
      .expect(httpStatus.CREATED)
      .then(res => {
        const resUser = res.body.data;
        expect(typeof resUser._id).toBe('string');
        expect(resUser.username).toBe(user.username);
        expect(resUser.emailAddress).toBe(user.emailAddress);
        expect(resUser.accountStatus).toBe('notverified');
        expect(resUser).not.toHaveProperty('password');
        expect(typeof res.body.token).toBe('string');
        userId = resUser._id;
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(() => {
        // flow-disable-next-line
        return Verification.findOne({ user: userId }).then(verDoc => {
          if (!verDoc) {
            return done('no verification token found');
          }
          return verDoc.resetToken;
        });
      })
      .then(activationToken => {
        return request(app)
          .get(`/api/auth/activate/${activationToken}`)
          .expect(httpStatus.OK)
          .then(res => {
            expect(res.text).toContain('Account activated');
          });
      })
      .then(() => {
        return request(app)
          .post('/api/auth/login')
          .send({
            emailAddress: user.emailAddress,
            password: user.password,
          })
          .expect(httpStatus.OK)
          .then(res => {
            expect(res.body).toHaveProperty('token');
            jwtToken = res.body.token;
          });
      })
      .then(() => {
        return request(app)
          .post('/api/users')
          .send(anotherUser)
          .expect(httpStatus.CREATED)
          .then(res => {
            expect(res.body.data.emailAddress).toBe(anotherUser.emailAddress);
            anotherUserId = res.body.data._id;
          })
          .then(() => {
            // flow-disable-next-line
            return Verification.findOne({ user: anotherUserId }).then(
              verDoc => {
                if (!verDoc) {
                  return done('no verification token found');
                }
                return verDoc.resetToken;
              }
            );
          })
          .then(activationToken => {
            return request(app)
              .get(`/api/auth/activate/${activationToken}`)
              .expect(httpStatus.OK)
              .then(res => {
                expect(res.text).toContain('Account activated');
              });
          })
          .then(() => {
            return request(app)
              .post('/api/auth/login')
              .send({
                emailAddress: anotherUser.emailAddress,
                password: anotherUser.password,
              })
              .expect(httpStatus.OK)
              .then(res => {
                expect(res.body).toHaveProperty('token');
                anotherJwtToken = res.body.token;
                done();
              });
          });
      })
      .then(() => {
        request(app)
          .post('/api/products')
          .set('Authorization', jwtToken)
          .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
          .field(product)
          .expect(httpStatus.CREATED)
          .then(res => {
            expect(typeof res.body.data).toBe('object');
          });
      })
      .then(() => {
        request(app)
          .post('/api/products')
          .set('Authorization', anotherJwtToken)
          .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
          .field(anotherProduct)
          .expect(httpStatus.CREATED)
          .then(res => {
            expect(res.body.data.tags).toHaveLength(0);
            expect(typeof res.body.data).toBe('object');
            done();
          });
      });
  });

  describe('# GET /api/feed/flat', () => {
    beforeAll(done => {
      request(app)
        .post(`/api/users/${anotherUserId}/follow`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.CREATED)
        .then(res => {
          const { data } = res.body;
          expect(data.follower).toBe(userId);
          expect(data.following).toBe(anotherUserId);
          expect(Object.keys(data).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
          done();
        });
    });

    it('should get my feed', async () => {
      return request(app)
        .get('/api/feed/flat')
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data).toHaveLength(1);
        });
    });

    it('should not get my feed if i am not authenticated', async () => {
      return request(app)
        .get('/api/feed/flat')
        .expect(httpStatus.UNAUTHORIZED)
        .then();
    });
  });
});
