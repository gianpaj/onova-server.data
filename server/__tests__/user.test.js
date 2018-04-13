// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';
import jwt from 'jsonwebtoken';

import app from '../index';
import config from '../config/config';
import Verification from '../models/verification.model';
import Follow from '../models/follow.model';
import User from '../models/user.model';
import DefaultFollow from '../models/defaultFollow.model';
import { createUserAndLogin } from './utils';

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

// GET /api/users/ should only return these fields
const userFields = [
  '_id',
  'accountStatus',
  'emailAddress',
  'followersCount',
  'followingCount',
  'username',
];

// POST /api/auth/login should only return these fields
const authFields = ['data', 'token'];

describe('## User APIs', () => {
  beforeAll(done => {
    const collections = [
      Follow.collection,
      User.collection,
      DefaultFollow.collection,
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

  let user = {
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    mobileNumber: '1234567890', // optional
    password: 'expressos',
  };

  const userShippingAddress = {
    shippingAddress: {
      line1: '11 Wall Street',
      line2: '',
      city: 'New York',
      state: 'NY',
    },
  };

  const userPaymentInfo = {
    last_four: '4442',
    exp_month: '10',
    exp_year: '20',
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

  let forthUser = {
    username: 'forthuser',
    emailAddress: 'gianpa+forthuser@gmail.com',
    password: 'express3',
  };

  const invalidUserCredentials = {
    emailAddress: 'gianpa-react@gmail.com',
    password: 'IDontKnow',
  };

  let userId;
  let anotherUserId;
  let forthUserId;
  let jwtToken;
  let anotherJwtToken;
  let forthJwtToken;
  let activationToken;
  let resetToken;

  describe('# Create and verify email address', function() {
    it('# POST /api/users - should create a new user', done => {
      request(app)
        .post('/api/users')
        .send(user)
        .expect(httpStatus.CREATED)
        .then(res => {
          const resUser = res.body.data;
          expect(typeof resUser._id).toBe('string');
          expect(resUser.accountStatus).toBe('notverified');
          expect(resUser.emailAddress).toBe(user.emailAddress);
          expect(resUser.followersCount).toBe(0);
          expect(resUser.followingCount).toBe(0);
          expect(resUser.username).toBe(user.username);
          expect(typeof res.body.token).toBe('string');
          expect(Object.keys(resUser).sort()).toEqual(userFields.sort());

          userId = resUser._id;
          done();
        })
        .catch(done);
    });

    it('# POST /api/users - should create a new user without mobile num', done => {
      request(app)
        .post('/api/users')
        .send(thirdUser)
        .expect(httpStatus.CREATED)
        .then(res => {
          const resUser = res.body.data;
          expect(typeof resUser._id).toBe('string');
          expect(resUser.username).toBe(thirdUser.username);
          expect(resUser.emailAddress).toBe(thirdUser.emailAddress);
          expect(resUser.accountStatus).toBe('notverified');
          expect(resUser.followersCount).toBe(0);
          expect(resUser.followingCount).toBe(0);
          expect(typeof res.body.token).toBe('string');
          expect(Object.keys(resUser).sort()).toEqual(userFields.sort());

          done();
        })
        .catch(done);
    });

    it('# POST /api/users - should not create a user with an invalid username (space)', done => {
      const user1 = { emailAddress: 'u1@gmail.com', username: 'white space' };
      request(app)
        .post('/api/users')
        .send({ ...user, ...user1 })
        .expect(httpStatus.BAD_REQUEST)
        .then(done())
        .catch(done);
    });

    it('# POST /api/users - should not create a user with an invalid username (@ char)', done => {
      const user2 = { emailAddress: 'user2@gmail.com', username: 'at@sign' };
      request(app)
        .post('/api/users')
        .send({ ...user, ...user2 })
        .expect(httpStatus.BAD_REQUEST)
        .then(done())
        .catch(done);
    });

    it('# POST /api/users - should create a user with an invalid username (cyrilic alphabet)', done => {
      const user3 = { emailAddress: 'user3@gmail.com', username: 'Кплнаше' };
      request(app)
        .post('/api/users')
        .send({ ...user, ...user3 })
        .expect(httpStatus.BAD_REQUEST)
        .then(done())
        .catch(done);
    });

    it('# POST /api/users - should create a user with a valid username (. dot)', done => {
      const user5 = { emailAddress: 'user5@gmail.com', username: 'user.user' };
      request(app)
        .post('/api/users')
        .send({ ...user, ...user5 })
        .expect(httpStatus.CREATED)
        .then(done())
        .catch(done);
    });

    it('# POST /api/users - should create a user with a valid username (_ char)', done => {
      const user6 = { emailAddress: 'u6@gmail.com', username: 'under_score' };
      request(app)
        .post('/api/users')
        .send({ ...user, ...user6 })
        .expect(httpStatus.CREATED)
        .then(done())
        .catch(done);
    });

    it('# POST /api/users - should not create a user with the same email address', done => {
      request(app)
        .post('/api/users')
        .send(user)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'An account with the same email address or username exists.'
          );
          done();
        })
        .catch(done);
    });

    it('# POST /api/users - should not create a user with a short password', done => {
      request(app)
        .post('/api/users')
        .send({ ...user, password: '123' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"password" length must be at least 8 characters long'
          );
          done();
        })
        .catch(done);
    });

    it('# GET /api/auth/activate/:token (page) - should activate the user', done => {
      Verification.findOne({ user: userId }, (err, verDoc) => {
        if (err) {
          return done(err);
        }
        if (!verDoc) {
          return done('no verification token found');
        }
        activationToken = verDoc.resetToken;
        request(app)
          .get(`/api/auth/activate/${activationToken}`)
          .expect(httpStatus.OK)
          .then(res => {
            expect(res.text).toContain('Account activated');
            done();
          })
          .catch(done);
      });
    });

    it('# GET /api/auth/activate/:token (page) - should not reactivate the user', done => {
      request(app)
        .get(`/api/auth/activate/${activationToken}`)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.text).toContain(
            'something wrong with the link you received'
          );
          done();
        })
        .catch(done);
    });

    it('# GET /api/auth/activate/:token (page) - an expired link should not work', done => {
      request(app)
        .get(`/api/auth/activate/e700760eb3d6fc65`)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.text).toContain(
            'something wrong with the link you received'
          );
          done();
        })
        .catch(done);
    });
  });

  describe('# POST /api/auth/login', () => {
    it('should return Authentication error', done => {
      request(app)
        .post('/api/auth/login')
        .send(invalidUserCredentials)
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Authentication error');
          done();
        })
        .catch(done);
    });

    it('should get valid JWT token', done => {
      request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: user.emailAddress,
          password: user.password,
        })
        .expect(httpStatus.OK)
        .then(res => {
          const { body } = res;
          expect(body).toHaveProperty('token');
          const token = body.token.split('JWT ')[1];
          expect(Object.keys(body).sort()).toEqual(authFields.sort());
          expect(Object.keys(body.data).sort()).toEqual(
            ['_id', 'accountStatus', 'emailAddress', 'username'].sort()
          );
          jwt.verify(token, config.jwtSecret, (err, decoded) => {
            expect(err).toBeFalsy();
            expect(decoded.emailAddress).toBe(user.emailAddress);
            jwtToken = body.token;
          });
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/users/:userId', () => {
    it("should get the user's details (public)", done => {
      request(app)
        .get(`/api/users/${userId}`)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.username).toBe(user.username);
          expect(res.body.emailAddress).toBe(user.emailAddress);
          expect(res.body.followersCount).toBe(0);
          expect(res.body.followingCount).toBe(0);
          expect(Object.keys(res.body).sort()).toEqual(userFields.sort());
          done();
        })
        .catch(done);
    });

    it('should report error with message - When user does not exists', done => {
      request(app)
        .get('/api/users/56c787ccc67fc16ccc1a5e92')
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Invalid user');
          done();
        })
        .catch(done);
    });
  });

  describe('# PUT /api/users/:userId', () => {
    it("should update user's details", done => {
      user.mobileNumber = '9876543212';
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.emailAddress).toBe(user.emailAddress);
          expect(res.body.mobileNumber).toBe(user.mobileNumber);
          expect(res.body.username).toBe(user.username);
          expect(res.body.accountStatus).toBe('verified');
          done();
        })
        .catch(done);
    });

    it("should update user's bio", done => {
      const bio = 'born to make a profit';
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send({ ...user, bio })
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.emailAddress).toBe(user.emailAddress);
          expect(res.body.bio).toBe(bio);
          expect(res.body.mobileNumber).toBe(user.mobileNumber);
          expect(res.body.username).toBe(user.username);
          expect(res.body.accountStatus).toBe('verified');
          done();
        })
        .catch(done);
    });

    it('should update only the password', done => {
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send({ password: 'express123' })
        .expect(httpStatus.OK)
        .then(res => {
          const { body } = res;
          expect(body.emailAddress).toBe(user.emailAddress);
          expect(body.mobileNumber).toBe(user.mobileNumber);
          expect(body.username).toBe(user.username);
          expect(body.accountStatus).toBe('verified');
          return request(app)
            .post('/api/auth/login')
            .send({
              emailAddress: user.emailAddress,
              password: 'express123',
            })
            .expect(httpStatus.OK)
            .then(res => {
              expect(res.body).toHaveProperty('token');
              done();
            });
        })
        .catch(done);
    });

    it('should update user email and unverify it', done => {
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send({ emailAddress: 'express123@gmail.com' })
        .expect(httpStatus.OK)
        .then(res => {
          user.emailAddress = res.body.emailAddress;
          expect(res.body.emailAddress).toBe('express123@gmail.com');
          expect(res.body.mobileNumber).toBe(user.mobileNumber);
          expect(res.body.username).toBe(user.username);
          expect(res.body.accountStatus).toBe('notverified');
          done();
        })
        .catch(done);
    });

    it("should update user's shipping info", done => {
      const tempuser = {
        ...user,
        ...userShippingAddress,
      };
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(tempuser)
        .expect(httpStatus.OK)
        .then(res => {
          const { body } = res;
          const { shippingAddress } = userShippingAddress;
          const shipInfo = body.shippingAddress;
          expect(body.emailAddress).toBe(tempuser.emailAddress);
          expect(body.mobileNumber).toBe(tempuser.mobileNumber);
          expect(body.username).toBe(tempuser.username);
          expect(shipInfo.line1).toBe(shippingAddress.line1);
          expect(shipInfo.city).toBe(shippingAddress.city);
          expect(shipInfo.state).toBe(shippingAddress.state);
          done();
        })
        .catch(done);
    });

    it("should update user's payment info", done => {
      const tempuser = {
        ...user,
        ...userPaymentInfo,
      };
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(tempuser)
        .expect(httpStatus.OK)
        .then(res => {
          const { body } = res;
          expect(body.emailAddress).toBe(tempuser.emailAddress);
          expect(body.mobileNumber).toBe(tempuser.mobileNumber);
          expect(body.username).toBe(tempuser.username);
          expect(body.paymentInfo).toEqual(userPaymentInfo);
          done();
        })
        .catch(done);
    });

    it("should update user's pushToken", done => {
      const tempuser = {
        ...user,
        pushToken: 'randomStringWith1020Numbers',
      };
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send({ pushToken: tempuser.pushToken })
        .expect(httpStatus.OK)
        .then(res => {
          const { body } = res;
          expect(body.emailAddress).toBe(tempuser.emailAddress);
          expect(body.mobileNumber).toBe(tempuser.mobileNumber);
          expect(body.username).toBe(tempuser.username);
          expect(body.paymentInfo).toEqual(userPaymentInfo);
          expect(body.pushToken).toEqual(tempuser.pushToken);
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/users/', () => {
    it('should get personal info', done => {
      request(app)
        .get(`/api/users/${userId}/personal`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { body } = res;
          const { shippingAddress } = userShippingAddress;
          const shipInfo = body.shippingAddress;
          expect(body.username).toBe(user.username);
          expect(body.emailAddress).toBe(user.emailAddress);
          expect(body.paymentInfo).toEqual(userPaymentInfo);
          expect(shipInfo.line1).toBe(shippingAddress.line1);
          expect(shipInfo.city).toBe(shippingAddress.city);
          expect(shipInfo.state).toBe(shippingAddress.state);
          done();
        })
        .catch(done);
    });

    it('should get all users', done => {
      request(app)
        .get('/api/users')
        .expect(httpStatus.OK)
        .then(res => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(4);
          expect(Object.keys(res.body[0]).sort()).toEqual(userFields.sort());
          done();
        })
        .catch(done);
    });

    it('should get all users (with limit)', done => {
      request(app)
        .get('/api/users')
        .query({ limit: 10 })
        .expect(httpStatus.OK)
        .then(res => {
          expect(Array.isArray(res.body)).toBe(true);
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/users/?u=<username>', () => {
    const people = [
      {
        username: 'johnone',
        emailAddress: 'gianpa+john@gmail.com',
        mobileNumber: '1234567890',
        password: 'express2',
      },
      {
        username: 'johntwo',
        emailAddress: 'gianpa+two@gmail.com',
        mobileNumber: '1234567890',
        password: 'express2',
      },
      {
        username: 'johnperson',
        emailAddress: 'gianpa+person@gmail.com',
        mobileNumber: '1234567890',
        password: 'express2',
      },
      {
        username: 'maria',
        emailAddress: 'maria@gmail.com',
        mobileNumber: '1234567890',
        password: 'express2',
      },
    ];

    beforeAll(async () => {
      for (let i = 0; i < people.length; i++) {
        try {
          const u = await createUserAndLogin(people[i]);
          people[i]._id = u.user._id;
          people[i].jwtToken = u.jwtToken;
          if (u instanceof Error) throw u;
        } catch (err) {
          console.error(err);
        }
      }

      // delete `maria`
      const m = await request(app)
        .delete(`/api/users/${people[3]._id}`)
        .set('Authorization', people[3].jwtToken)
        .expect(httpStatus.OK);
      expect(m.body.emailAddress).toBe(people[3].emailAddress);
      expect(m.body.username).toBe(people[3].username);

      // update profile pic of `johntwo`
      await request(app)
        .put(`/api/users/${people[1]._id}`)
        .set('Authorization', people[1].jwtToken)
        .attach('profilePic', path.join(__dirname, 'images/profilepic.jpg'))
        .field('displayName', 'displayName the second john')
        .field('bio', 'bio the second john')
        .expect(httpStatus.OK);
    });

    it('should get all users which username contains `johntwo`', async () => {
      const userFields = [
        '_id',
        'accountStatus',
        'bio',
        'id',
        'username',
        'displayName',
        'profilePic',
      ];

      return request(app)
        .get('/api/users?u=johntwo')
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.length).toBe(1);
          expect(res.body[0].username).toBe(people[1].username);
          expect(Object.keys(res.body[0]).sort()).toEqual(userFields.sort());
        });
    });

    it('should get all users which username contains `person`', async () => {
      return request(app)
        .get('/api/users?u=person')
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.length).toBe(2);
          expect(res.body[0].username).toBe(user.username);
        });
    });

    it('should get all users which username contains `john`', async () => {
      return request(app)
        .get('/api/users?u=john')
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.length).toBe(3);
          expect(res.body[0].username).toBe(people[0].username);
        });
    });

    it('should not find deleted users', async () => {
      return request(app)
        .get('/api/users?u=maria')
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.length).toBe(0);
        });
    });
  });

  describe('# DELETE /api/users/:userId', () => {
    beforeAll(done => {
      createUserAndLogin(anotherUser).then(({ user }) => {
        anotherUserId = user._id;
        done();
      });
    });

    it('should delete user', done => {
      request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.emailAddress).toBe(user.emailAddress);
          expect(res.body.mobileNumber).toBe(user.mobileNumber);
          expect(res.body.username).toBe(user.username);
          done();
        })
        .catch(done);
    });

    // it('should not get users which username`s contains `віктор`', async () => {
    //   return request(app)
    //     .get('/api/users?u=віктор')
    //     .expect(httpStatus.BAD_REQUEST)
    //     .then();
    // });

    it('first user should not delete another user', done => {
      request(app)
        .delete(`/api/users/${anotherUserId}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(done())
        .catch(done);
    });

    it('should get error when deleting invalid user', done => {
      request(app)
        .delete(`/api/users/59f91cac9b4645049289f6f`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Invalid user');
          done();
        })
        .catch(done);
    });
  });

  describe('# PUT /api/users/:userId', () => {
    beforeAll(done => {
      createUserAndLogin(forthUser)
        .then(({ user, jwtToken: token }) => {
          forthUserId = user._id;
          forthJwtToken = token;
          done();
        })
        .catch(err => {
          console.error(err);
          done();
        });
    });

    it('should not update an user`s email to an existing one', async () => {
      return request(app)
        .put(`/api/users/${forthUserId}`)
        .set('Authorization', forthJwtToken)
        .send({ ...forthUser, emailAddress: anotherUser.emailAddress })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'An account with the same email address exists.'
          );
        });
    });

    it("should not update an user's username to an existing one", done => {
      request(app)
        .put(`/api/users/${forthUserId}`)
        .set('Authorization', forthJwtToken)
        .send({
          emailAddress: 'newemail@example.com',
          username: anotherUser.username,
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'An account with the same username exists.'
          );
          user.username = 'firstperson';
          done();
        })
        .catch(done);
    });
  });

  describe('# POST /api/auth/login', () => {
    it('should get another valid JWT token', done => {
      request(app)
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
        })
        .catch(done);
    });
  });

  describe('# PUT /api/users/:userId', () => {
    it("should upload the user's profile pic", async () => {
      return request(app)
        .put(`/api/users/${anotherUserId}`)
        .set('Authorization', anotherJwtToken)
        .attach('profilePic', path.join(__dirname, 'images/profilepic.jpg'))
        .expect(httpStatus.OK);
    });

    it("should not update another user's details", async () => {
      user.mobileNumber = '9876543212';
      return request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', anotherJwtToken)
        .send(user)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('# GET /api/auth/random-number', () => {
    it('should fail to get random number because of missing Authorization', done => {
      request(app)
        .get('/api/auth/random-number')
        .expect(httpStatus.UNAUTHORIZED)
        .then(done())
        .catch(done);
    });

    it('should fail to get random number because of wrong token', done => {
      request(app)
        .get('/api/auth/random-number')
        .set('Authorization', 'JWT inValidToken')
        .expect(httpStatus.UNAUTHORIZED)
        .then(done())
        .catch(done);
    });

    it('should get a random number', done => {
      request(app)
        .get('/api/auth/random-number')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(typeof res.body.num).toBe('number');
          done();
        })
        .catch(done);
    });
  });

  describe('Password reset', () => {
    it('# POST /api/auth/reset - should request a password reset via email', done => {
      request(app)
        .post('/api/auth/reset')
        .send({ emailAddress: anotherUser.emailAddress })
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.message).toBe('Password reset email sent.');
          done();
        })
        .catch(done);
    });

    it('# POST /api/auth/reset/:token (page) - should reset the user`s password', done => {
      User.findOne(
        { emailAddress: anotherUser.emailAddress },
        (err, existingUser) => {
          if (err) {
            return done(err);
          }

          Verification.findOne({ user: existingUser._id }, (err, verDoc) => {
            if (err) return done(err);
            if (!verDoc) return done('no verification token found');
            resetToken = verDoc.resetToken;
            request(app)
              .post(`/api/auth/reset/${verDoc.resetToken}`)
              .send({ password: 'americano', passwordagain: 'americano' })
              .expect(httpStatus.OK)
              .then(res => {
                expect(res.text).toContain('Your password has been updated');
                anotherUser.password = 'americano';
                done();
              })
              .catch(done);
          });
        }
      );
    });

    it('# POST /api/auth/reset/:token (page) - should not reset the user`s password', done => {
      request(app)
        .post(`/api/auth/reset/${resetToken}`)
        .send({ password: 'americano', passwordagain: 'americano' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.text).toContain(
            'There was an issue resetting your password'
          );
          done();
        })
        .catch(done);
    });

    it('# POST /api/auth/reset/:token (page) - should not reset the user`s password', done => {
      request(app)
        .post(`/api/auth/reset/12343375d1`)
        .send({ password: 'americano', passwordagain: 'americano' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"token" length must be 16 characters long'
          );
          done();
        })
        .catch(done);
    });

    it('# POST /api/auth/login - should authenticate again', done => {
      request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: anotherUser.emailAddress,
          password: anotherUser.password,
        })
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body).toHaveProperty('token');
          done();
        })
        .catch(done);
    });
  });
});
