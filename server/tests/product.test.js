import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';
import chai, { expect } from 'chai';
import path from 'path';

import app from '../index';

import Verification from '../models/verification.model';
import User from '../models/user.model';
import Product from '../models/product.model';

chai.config.includeStack = true;

/**
 * root level hooks
 */
after(done => {
  // required because https://github.com/Automattic/mongoose/issues/1251#issuecomment-65793092
  mongoose.models = {};
  mongoose.modelSchemas = {};
  mongoose.connection.close();
  done();
});

before(done => {
  mongoose.connection.dropDatabase().then(() => {
    done();
  });
});

describe.only('## Product APIs', () => {
  let user = {
    username: 'firstperson',
    emailAddress: 'first@example.com',
    mobileNumber: '1234567890', // optional
    // displayName: 'first user',
    password: 'expressos',
  };

  let product = {
    // photoURIs: 'photoURIs',
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    // tags: 'tags', //optional
    description: 'nice boots',
    // seller comes after the user is created
    price: 10099, // 100.99 UAH
  };

  before(done => {
    // create user (seller)
    request(app)
      .post('/api/users')
      .send(user)
      .expect(httpStatus.CREATED)
      .then(res => {
        const resUser = res.body.user;
        expect(resUser._id).to.a('string');
        expect(resUser.username).to.equal(user.username);
        expect(resUser.emailAddress).to.equal(user.emailAddress);
        expect(resUser.accountStatus).to.equal('notverified');
        expect(resUser).to.not.have.property('password');
        expect(res.body.token).to.be.a('string');

        user._id = resUser._id;
        product.seller = resUser._id;
      })
      .then(() => {
        return Verification.findOne({ user: user._id }).then(verDoc => {
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
            expect(res.text).to.contain('Account activated');
            done();
          });
      })
      .catch(done);
  });

  describe('# POST /api/products', () => {
    it('# Create product', done => {
      request(app)
        .post('/api/products')
        .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .field(product)
        .expect(httpStatus.CREATED)
        .then(res => {
          console.log(res.body);
          // expect(res.body.product.description).to.equal(product.description);
          done();
        })
        // .catch(error => {
        //   throw error;
        // });
        .catch(done);
    });
  });
});
