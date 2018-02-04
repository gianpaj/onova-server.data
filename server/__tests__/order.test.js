// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';
// import config from '../config/config';
import Verification from '../models/verification.model';
import User from '../models/user.model';
import Tag from '../models/tag.model';
import Product from '../models/product.model';
import Order from '../models/order.model';

// GET /api/orders/ should only return these fields
const orderFields = [
  'buyer',
  'currency',
  'datePending',
  'onovaFee',
  'priceOfItem',
  'product',
  'seller',
  'status',
  'transationStatus',
];

describe('## Order APIs', () => {
  beforeAll(done => {
    // mongoose.connection.dropDatabase().then(done);
    const collections = [
      User.collection,
      Product.collection,
      Order.collection,
      Tag.collection,
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

  let anotherUser = {
    username: 'anotherperson',
    emailAddress: 'gianpa+test2@gmail.com',
    mobileNumber: '1234567890', // optional
    password: 'express2',
  };

  let product = {
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    tags: ['winter', 'spring2007'], // optional
    description: 'nice boots',
    // seller id is the user who creates the product
    price: '100.99', // if no decimal points .00 will be added
  };

  let anotherProduct = {
    categoryIds: [3],
    typeIds: [1, 3],
    tags: ['summer'], // optional
    description: 'nice flipflops',
    // seller id is the user who creates the product
    price: '10.99', // if no decimal points .00 will be added
  };

  let productUuid;
  let anotherProductUuid;
  let jwtToken;
  let anotherJwtToken;
  let activationToken;

  // create 2 users/sellers
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
        // flow-disable-next-line
        user._id = resUser._id;
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(() => {
        // flow-disable-next-line
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
            const resUser = res.body.data;
            expect(resUser.emailAddress).toBe(anotherUser.emailAddress);
            expect(resUser.accountStatus).toBe('notverified');
            // flow-disable-next-line
            anotherUser._id = res.body.data._id;
          })
          .then(() => {
            // flow-disable-next-line
            return Verification.findOne({ user: anotherUser._id }).then(
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
      });
  });

  describe('# POST /api/orders', () => {
    beforeAll(done => {
      let Promises = [];
      Promises.push(
        new Promise((resolve, reject) => {
      request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
        .field(product)
        .expect(httpStatus.CREATED)
        .then(res => {
          const p = res.body.data;
          expect(p.currency).toBe('UAH');
          expect(p.description).toBe(product.description);
          expect(p.price).toBe(product.price);
          // flow-disable-next-line
          expect(p.seller).toBe(user._id);
          expect(p.status).toBe('forsale');
          productUuid = p.uuid;
              resolve();
            })
            .catch(() => reject());
        })
      );

      Promises.push(
        new Promise((resolve, reject) => {
          request(app)
            .post('/api/products')
            .set('Authorization', jwtToken)
            .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
            .field(anotherProduct)
            .expect(httpStatus.CREATED)
            .then(res => {
              const p = res.body.data;
              expect(p.currency).toBe('UAH');
              expect(p.description).toBe(anotherProduct.description);
              expect(p.price).toBe(anotherProduct.price);
              // flow-disable-next-line
              expect(p.seller).toBe(user._id);
              expect(p.status).toBe('forsale');
              anotherProductUuid = p.uuid;

              return request(app)
                .delete(`/api/products/${anotherProductUuid}`)
                .set('Authorization', jwtToken)
                .expect(httpStatus.NO_CONTENT)
                .then(res => {
                  expect(res.body).toMatchObject({});
                  resolve();
                });
            })
            .catch(() => reject());
        })
      );

      Promise.all(Promises).then(() => {
          done();
        });
    });

    it('should create an order', async () => {
      let orderOne = {
        product: productUuid,
      };

      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send(orderOne)
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          productUuid = o.product._id;
        });
    });

    it('should not create an order with an invalid product', async () => {
      let orderOne = {
        product: 'productUuid',
      };

      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send(orderOne)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Product not found');
        });
  });

    it('should not create an order if the product is not for sale', async () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send({ product: anotherProductUuid })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('This product is not longer for sale or is reserved.');
        });
    });
  });
});
