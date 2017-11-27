import request from 'supertest';
import httpStatus from 'http-status';
import chai, { expect } from 'chai';
import path from 'path';

import app from '../index';

import Verification from '../models/verification.model';
import User from '../models/user.model';
import Product from '../models/product.model';

chai.config.containStack = true;

describe('## Product APIs', () => {
  before(done => {
    const collections = [Product.collection, User.collection];

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

  let productUuid;

  before(done => {
    // create user (seller)
    request(app)
      .post('/api/users')
      .send(user)
      .expect(httpStatus.CREATED)
      .then(res => {
        const resUser = res.body.data;
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
    it('should create product', done => {
      request(app)
        .post('/api/products')
        .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .field(product)
        .expect(httpStatus.CREATED)
        .then(res => {
          console.log(res.body);
          const p = res.body.data;
          expect(p.description).to.equal(product.description);
          expect(p.seller).to.equal(product.seller);
          expect(p.status).to.equal('forsale');
          expect(p.currency).to.equal('UAH');
          expect(p.likes).to.be.an('array').that.is.empty;
          expect(p.comments).to.be.an('array').that.is.empty;
          expect(p.tags).to.be.an('array').that.is.empty;
          expect(p.typeIds.sort()).to.deep.equal([1, 2, 3]);
          expect(p.categoryIds.sort()).to.deep.equal([1, 2, 3]);
          expect(p.photoURIs).to.have.lengthOf(2);
          productUuid = p.uuid;
          done();
        })
        .catch(done);
    });

    it('should not create product with wrong file uploaded', done => {
      request(app)
        .post('/api/products')
        .attach('photos', path.join(__dirname, 'misc.test.js'))
        .field(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).to.contain(
            'File upload only supports the following filetypes'
          );
          done();
        })
        .catch(done);
    });

    it('should not create product without uploading a photo', done => {
      request(app)
        .post('/api/products')
        .field(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).to.equal('Product image(s) are required');
          done();
        })
        .catch(done);
    });

    it('should not create product without a valid seller', done => {
      request(app)
        .post('/api/products')
        .field({ ...product, seller: '5a1b50bfa4c57109cf583235' })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).to.equal('Seller not found');
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/products/:uuid', () => {
    it('should get an existing product', done => {
      request(app)
        .get(`/api/products/${productUuid}`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(p.description).to.equal(product.description);
          expect(p.seller._id).to.equal(product.seller);
          expect(p.status).to.equal('forsale');
          expect(p.currency).to.equal('UAH');
          expect(p.likes).to.be.an('array').that.is.empty;
          expect(p.comments).to.be.an('array').that.is.empty;
          expect(p.tags).to.be.an('array').that.is.empty;
          expect(p.typeIds.sort()).to.deep.equal([1, 2, 3]);
          expect(p.categoryIds.sort()).to.deep.equal([1, 2, 3]);
          expect(p.photoURIs).to.have.lengthOf(2);
          done();
        })
        .catch(done);
    });

    it('should not get an non valid product', done => {
      request(app)
        .get('/api/products/SkveMe9lz')
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          console.log(res.body);
          expect(res.body.message).to.equal('Invalid product');
          done();
        })
        .catch(done);
    });
  });
});
