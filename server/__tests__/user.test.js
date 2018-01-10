import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';

import app from '../index';
import config from '../config/config';
import Verification from '../models/verification.model';
import User from '../models/user.model';

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

describe('## User APIs', () => {
  beforeAll(done => {
    // mongoose.connection.dropDatabase().then(done);
    const collections = [User.collection];

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

  const invalidUserCredentials = {
    emailAddress: 'gianpa-react@gmail.com',
    password: 'IDontKnow',
  };

  let userId;
  let anotherUserId;
  let jwtToken;
  let anotherJwtToken;
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
          expect(resUser.username).toBe(user.username);
          expect(resUser.emailAddress).toBe(user.emailAddress);
          expect(resUser.accountStatus).toBe('notverified');
          expect(resUser).not.toHaveProperty('password');
          expect(typeof res.body.token).toBe('string');

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
          expect(resUser).not.toHaveProperty('password');
          expect(typeof res.body.token).toBe('string');

          done();
        })
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
          expect(res.body).toHaveProperty('token');
          const token = res.body.token.split('JWT ')[1];
          jwt.verify(token, config.jwtSecret, (err, decoded) => {
            expect(err).toBeFalsy();
            expect(decoded.emailAddress).toBe(user.emailAddress);
            jwtToken = res.body.token;
            done();
          });
        })
        .catch(done);
    });
  });

  describe('# GET /api/users/:userId', () => {
    it('should get user details', done => {
      request(app)
        .get(`/api/users/${userId}`)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.username).toBe(user.username);
          expect(res.body.emailAddress).toBe(user.emailAddress);
          expect(res.body.mobileNumber).toBe(user.mobileNumber);
          expect(res.body).not.toHaveProperty('password');
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
    it('should update user details', done => {
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

    it('should update user email and unverify it', done => {
      user.emailAddress = 'newemail@example.com';
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.emailAddress).toBe(user.emailAddress);
          expect(res.body.mobileNumber).toBe(user.mobileNumber);
          expect(res.body.username).toBe(user.username);
          expect(res.body.accountStatus).toBe('notverified');
          done();
        })
        .catch(done);
    });

    it('should update user payment info', done => {
      const tempuser = {
        ...user,
        last_four: '4442',
        exp_month: '10',
        exp_year: '20',
      };
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(tempuser)
        .expect(httpStatus.OK)
        .then(res => {
          const body = res.body;
          const payInfo = body.paymentInfo;
          expect(body.emailAddress).toBe(tempuser.emailAddress);
          expect(body.mobileNumber).toBe(tempuser.mobileNumber);
          expect(body.username).toBe(tempuser.username);
          expect(payInfo.last_four).toBe(tempuser.last_four);
          expect(payInfo.exp_month).toBe(tempuser.exp_month);
          expect(payInfo.exp_year).toBe(tempuser.exp_year);
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/users/', () => {
    it('should get all users', done => {
      request(app)
        .get('/api/users')
        .expect(httpStatus.OK)
        .then(res => {
          expect(Array.isArray(res.body)).toBe(true);
          done();
        })
        .catch(done);
    });

    it('should get all users (with limit and skip)', done => {
      request(app)
        .get('/api/users')
        .query({ limit: 10, skip: 1 })
        .expect(httpStatus.OK)
        .then(res => {
          expect(Array.isArray(res.body)).toBe(true);
          done();
        })
        .catch(done);
    });
  });

  describe('# DELETE /api/users/', () => {
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
  });

  describe('# POST /api/users/:userId', () => {
    beforeAll(done => {
      request(app)
        .post('/api/users')
        .send(anotherUser)
        .expect(httpStatus.CREATED)
        .then(res => {
          anotherUserId = res.body.data._id;
          done();
        })
        .catch(done);
    });

    it('first user should not delete another user', done => {
      request(app)
        .delete(`/api/users/${anotherUserId}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(() => done())
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
      request(app)
        .post('/api/users')
        .send(user)
        .expect(httpStatus.CREATED)
        .then(res => {
          userId = res.body.data._id;
          jwtToken = res.body.token;
          done();
        })
        .catch(done);
    });

    it('should not update an user email to an existing one', done => {
      user.emailAddress = anotherUser.emailAddress;
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'An account with the same email address exists.'
          );
          // reset the email
          user.emailAddress = 'newemail@example.com';
          done();
        })
        .catch(done);
    });

    it("should not update an user's username to an existing one", done => {
      user.username = anotherUser.username;
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'An account with the same username exists.'
          );
          // reset the email
          user.username = 'firstperson';
          done();
        })
        .catch(done);
    });

    it('should update a user password', done => {
      user.password = 'secure123';
      request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.OK)
        .then(() => done())
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
          const token = res.body.token.split('JWT ')[1];
          jwt.verify(token, config.jwtSecret, (err, decoded) => {
            expect(err).toBeFalsy();
            expect(decoded.emailAddress).toBe(anotherUser.emailAddress);
            anotherJwtToken = res.body.token;
            done();
          });
        })
        .catch(done);
    });
  });

  describe('# GET /api/auth/random-number', () => {
    it('should fail to get random number because of missing Authorization', done => {
      request(app)
        .get('/api/auth/random-number')
        .expect(httpStatus.UNAUTHORIZED)
        .then(() => done())
        .catch(done);
    });

    it('should fail to get random number because of wrong token', done => {
      request(app)
        .get('/api/auth/random-number')
        .set('Authorization', 'JWT inValidToken')
        .expect(httpStatus.UNAUTHORIZED)
        .then(() => done())
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
            if (err) {
              return done(err);
            }
            if (!verDoc) {
              return done('no verification token found');
            }
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
