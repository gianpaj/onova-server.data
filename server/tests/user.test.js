import mongoose from 'mongoose';
import request from 'supertest-as-promised';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import chai, { expect } from 'chai';
import crypto from 'crypto';

import app from '../index';
import config from '../config/config';
import Verification from '../models/verification.model';

chai.config.includeStack = true;

/**
 * root level hooks
 */
after((done) => {
  // required because https://github.com/Automattic/mongoose/issues/1251#issuecomment-65793092
  mongoose.models = {};
  mongoose.modelSchemas = {};
  mongoose.connection.close();
  done();
});

before((done) => {
  mongoose.connection.dropDatabase().then(() => {
    done();
  })
});

describe('## User APIs', () => {
  let user = {
    username: 'reactperson',
    emailAddress: 'react@example.com',
    mobileNumber: '1234567890', // optional
    displayName: 'Johnny Bravo',
    password: 'expressos'
  };

  let anotherUser = {
    username: 'angularperson',
    emailAddress: 'angular@example.com',
    mobileNumber: '1234567890', // optional
    displayName: 'Mary Jane',
    password: 'express2'
  };

  let thirdUser = {
    username: 'thirdwheel',
    emailAddress: 'thirdwheel@example.com',
    displayName: 'Tercero Jane',
    password: 'express3'
  };

  const invalidUserCredentials = {
    emailAddress: 'react@example.com',
    password: 'IDontKnow'
  };

  let jwtToken;
  let anotherJwtToken;

  describe('# Create and verify email address', function () {
    this.timeout(4000);

    let activationToken;

    it('# POST /api/users - should create a new user', (done) => {
      request(app)
        .post('/api/users')
        .send(user)
        .expect(httpStatus.CREATED)
        .then((res) => {
          const resUser = res.body.user;
          expect(resUser._id).to.a('string');
          expect(resUser.username).to.equal(user.username);
          expect(resUser.emailAddress).to.equal(user.emailAddress);
          expect(resUser.accountStatus).to.equal('notverified');
          expect(resUser).to.not.have.property('password');
          expect(res.body.token).to.be.a('string');

          user._id = resUser._id;
          done();
        })
        .catch(done);
    });

    it('# POST /api/users - should create a new user without mobile num', (done) => {
      request(app)
        .post('/api/users')
        .send(thirdUser)
        .expect(httpStatus.CREATED)
        .then((res) => {
          const resUser = res.body.user;
          expect(resUser._id).to.a('string');
          expect(resUser.username).to.equal(thirdUser.username);
          expect(resUser.emailAddress).to.equal(thirdUser.emailAddress);
          expect(resUser.accountStatus).to.equal('notverified');
          expect(resUser).to.not.have.property('password');
          expect(res.body.token).to.be.a('string');

          done();
        })
        .catch(done);
    });

    it('# POST /api/users - should not create a user with the same email address', (done) => {
      request(app)
        .post('/api/users')
        .send(user)
        .expect(httpStatus.BAD_REQUEST)
        .then((res) => {
          expect(res.body.message).to.equal('Account with that email address already exists.');
          done();
        })
        .catch(done);
    });

    it('# GET /api/auth/activate/:token (page) - should activate the user', (done) => {
      Verification.findOne({user: user._id}, (err, verDoc) => {
        if(err) { return done(err); }
        if (!verDoc) {
          return done('no verification token found');
        }
        activationToken = verDoc.resetToken;
        request(app)
          .get(`/api/auth/activate/${activationToken}`)
          .expect(httpStatus.OK)
          .then((res) => {
            expect(res.text).to.contain('Account activated');
            done();
          })
          .catch(done);
      });
    });

    it('# GET /api/auth/activate/:token (page) - should not reactivate the user', (done) => {
      request(app)
        .get(`/api/auth/activate/${activationToken}`)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.text).to.contain('something wrong with the link you received');
          done();
        })
        .catch(done);
    });

    it('# GET /api/auth/activate/:token (page) - an expired link should not work', (done) => {
      request(app)
        .get(`/api/auth/activate/e700760eb3d6fc65`)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.text).to.contain('something wrong with the link you received');
          done();
        })
        .catch(done);
    });
  });

  describe('# POST /api/auth/login', () => {
    it('should return Authentication error', (done) => {
      request(app)
        .post('/api/auth/login')
        .send(invalidUserCredentials)
        .expect(httpStatus.UNAUTHORIZED)
        .then((res) => {
          expect(res.body.message).to.equal('Authentication error');
          done();
        })
        .catch(done);
    });

    it('should get valid JWT token', (done) => {
      request(app)
        .post('/api/auth/login')
        .send(user)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body).to.have.property('token');
          const token = res.body.token.split('JWT ')[1];
          jwt.verify(token, config.jwtSecret, (err, decoded) => {
            expect(err).to.not.be.ok;
            expect(decoded.emailAddress).to.equal(user.emailAddress);
            jwtToken = res.body.token;
            done();
          });
        })
        .catch(done);
    });
  });

  describe('# GET /api/users/:userId', () => {
    it('should get user details', (done) => {
      request(app)
        .get(`/api/users/${user._id}`)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.username).to.equal(user.username);
          expect(res.body.emailAddress).to.equal(user.emailAddress);
          expect(res.body.mobileNumber).to.equal(user.mobileNumber);
          expect(res.body).to.not.have.property('password');
          done();
        })
        .catch(done);
    });

    it('should report error with message - Not found, when user does not exists', (done) => {
      request(app)
        .get('/api/users/56c787ccc67fc16ccc1a5e92')
        .expect(httpStatus.BAD_REQUEST)
        .then((res) => {
          expect(res.body.message).to.equal('Bad Request');
          done();
        })
        .catch(done);
    });
  });

  describe('# PUT /api/users/:userId', () => {
    it('should update user details', (done) => {
      user.mobileNumber = '9876543212';
      request(app)
        .put(`/api/users/${user._id}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.emailAddress).to.equal(user.emailAddress);
          expect(res.body.mobileNumber).to.equal(user.mobileNumber);
          expect(res.body.username).to.equal(user.username);
          expect(res.body.accountStatus).to.equal('verified');
          done();
        })
        .catch(done);
    });

    it('should update user email and unverify it', (done) => {
      user.emailAddress = 'newemail@example.com';
      request(app)
        .put(`/api/users/${user._id}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.emailAddress).to.equal(user.emailAddress);
          expect(res.body.mobileNumber).to.equal(user.mobileNumber);
          expect(res.body.username).to.equal(user.username);
          expect(res.body.accountStatus).to.equal('notverified');
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/users/', () => {
    it('should get all users', (done) => {
      request(app)
        .get('/api/users')
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body).to.be.an('array');
          done();
        })
        .catch(done);
    });

    it('should get all users (with limit and skip)', (done) => {
      request(app)
        .get('/api/users')
        .query({ limit: 10, skip: 1 })
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body).to.be.an('array');
          done();
        })
        .catch(done);
    });
  });

  describe('# DELETE /api/users/', () => {
    it('should delete user', (done) => {
      request(app)
        .delete(`/api/users/${user._id}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.emailAddress).to.equal(user.emailAddress);
          expect(res.body.mobileNumber).to.equal(user.mobileNumber);
          expect(res.body.username).to.equal(user.username);
          done();
        })
        .catch(done);
    });
  });

  describe('# POST /api/users/:userId', () => {
    before(done => {
      request(app)
        .post('/api/users')
        .send(anotherUser)
        .expect(httpStatus.CREATED)
        .then((res) => {
          anotherUser._id = res.body.user._id;
          done();
        })
        .catch(done);
    });

    it('first user should not delete another user', (done) => {
      request(app)
        .delete(`/api/users/${anotherUser._id}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('should get error when deleting invalid user', (done) => {
      request(app)
        .delete(`/api/users/59f91cac9b4645049289f6f`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then((res) => {
          expect(res.body.message).to.equal('Bad Request');
          done();
        })
        .catch(done);
    });
  });

  describe('# PUT /api/users/:userId', () => {
    before(done => {
      request(app)
        .post('/api/users')
        .send(user)
        .expect(httpStatus.CREATED)
        .then((res) => {
          user._id = res.body.user._id;
          jwtToken = res.body.token;
          done();
        })
        .catch(done);
    });

    it('should not update an user email to an existing one', (done) => {
      user.emailAddress = anotherUser.emailAddress;
      request(app)
        .put(`/api/users/${user._id}`)
        .set('Authorization', jwtToken)
        .send(user)
        .expect(httpStatus.BAD_REQUEST)
        .then((res) => {
          expect(res.body.message).to.equal('Account with that email address already exists.');
          done();
        })
        .catch(done);
    });
  });

  describe('# POST /api/auth/login', () => {
    it('should get another valid JWT token', (done) => {
      request(app)
        .post('/api/auth/login')
        .send(anotherUser)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body).to.have.property('token');
          const token = res.body.token.split('JWT ')[1];
          jwt.verify(token, config.jwtSecret, (err, decoded) => {
            expect(err).to.not.be.ok;
            expect(decoded.emailAddress).to.equal(anotherUser.emailAddress);
            anotherJwtToken = res.body.token;
            done();
          });
        })
        .catch(done);
    });
  });

  describe('# GET /api/auth/random-number', () => {
    it('should fail to get random number because of missing Authorization', (done) => {
      request(app)
        .get('/api/auth/random-number')
        .expect(httpStatus.UNAUTHORIZED)
        .then((res) => {
          done();
        })
        .catch(done);
    });

    it('should fail to get random number because of wrong token', (done) => {
      request(app)
        .get('/api/auth/random-number')
        .set('Authorization', 'JWT inValidToken')
        .expect(httpStatus.UNAUTHORIZED)
        .then((res) => {
          done();
        })
        .catch(done);
    });

    it('should get a random number', (done) => {
      request(app)
        .get('/api/auth/random-number')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.num).to.be.a('number');
          done();
        })
        .catch(done);
    });
  });
});
