import mongoose from 'mongoose';
import request from 'supertest-as-promised';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import chai, { expect } from 'chai';
import app from '../../index';
import config from '../../config/config';

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

// describe('## User APIs', () => {
describe.only('## User APIs', () => {
  let user = {
    username: 'reactperson',
    emailAddress: 'react@example.com',
    mobileNumber: '1234567890', // optional
    password: 'express'
  };

  let anotherUser = {
    username: 'angularperson',
    emailAddress: 'angular@example.com',
    mobileNumber: '1234567890', // optional
    password: 'express2'
  };

  let jwtToken;

  describe('# POST /api/users', () => {
    it('should create a new user', (done) => {
      request(app)
        .post('/api/users')
        .send(user)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.username).to.equal(user.username);
          expect(res.body.mobileNumber).to.equal(user.mobileNumber);
          expect(res.body.emailAddress).to.equal(user.emailAddress);
          expect(res.body.accountStatus).to.equal('notverified');
          expect(res.body).to.not.have.property('password');
          // get user '_id'
          user = res.body;
          // add password back into the object
          user.password = 'express';
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
          jwt.verify(res.body.token, config.jwtSecret, (err, decoded) => {
            expect(err).to.not.be.ok; // eslint-disable-line no-unused-expressions
            expect(decoded.emailAddress).to.equal(user.emailAddress);
            jwtToken = `Bearer ${res.body.token}`;
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
        .expect(httpStatus.NOT_FOUND)
        .then((res) => {
          expect(res.body.message).to.equal('Not Found');
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
        .send(user)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.emailAddress).to.equal(user.emailAddress);
          expect(res.body.mobileNumber).to.equal('9876543212');
          expect(res.body.username).to.equal(user.username);
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

  describe('# POST /api/users', () => {
    it('should create another new user', (done) => {
      request(app)
        .post('/api/users')
        .send(anotherUser)
        .expect(httpStatus.OK)
        .then((res) => {
          expect(res.body.username).to.equal(anotherUser.username);
          expect(res.body.emailAddress).to.equal(anotherUser.emailAddress);
          expect(res.body.mobileNumber).to.equal(anotherUser.mobileNumber);
          anotherUser = res.body;
          done();
        })
        .catch(done);
    });

    it('should not delete another user', (done) => {
      request(app)
        .delete(`/api/users/${anotherUser._id}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.FORBIDDEN)
        .then((res) => {
          expect(res.body.message).to.equal('Not allowed');
          done();
        })
        .catch(done);
    });
  });
});
