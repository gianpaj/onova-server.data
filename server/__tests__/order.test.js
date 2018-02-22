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

// GET & PUT /api/orders/ should only return these fields
const orderFields = [
  'buyer',
  'currency',
  'datePending',
  'id',
  'onovaFee',
  'priceOfItem',
  'product',
  'seller',
  'status',
  'transactionStatus',
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

  let nonActiveUser = {
    username: 'thirdperson',
    emailAddress: 'gianpa+test3@gmail.com',
    mobileNumber: '1234567890',
    password: 'expressos',
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
    tags: ['summer'],
    description: 'nice flipflops',
    price: '10.99',
  };

  let thirdProduct = {
    categoryIds: [2],
    typeIds: [2, 3],
    description: 'nice shorts',
    price: '200.50',
  };

  let productUuid;
  let anotherProductUuid;
  let thirdProductUuid;
  let jwtToken;
  let anotherJwtToken;
  let nonActiveUserJwtToken;

  // create 3 users. 1 not activated
  beforeAll(done => {
    // @TODO use Promise.all().then(() => done());
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
              });
          })
          .then(() => {
            return request(app)
              .post('/api/users')
              .send(nonActiveUser)
              .expect(httpStatus.CREATED)
              .then(res => {
                const resUser = res.body.data;
                expect(typeof resUser._id).toBe('string');
                expect(resUser.username).toBe(nonActiveUser.username);
                expect(resUser.emailAddress).toBe(nonActiveUser.emailAddress);
                expect(resUser.accountStatus).toBe('notverified');
                expect(resUser).not.toHaveProperty('password');
                expect(typeof res.body.token).toBe('string');
                // flow-disable-next-line
                nonActiveUser._id = resUser._id;
              });
          })
          .then(() => {
            return request(app)
              .post('/api/auth/login')
              .send({
                emailAddress: nonActiveUser.emailAddress,
                password: nonActiveUser.password,
              })
              .expect(httpStatus.OK)
              .then(res => {
                expect(res.body).toHaveProperty('token');
                nonActiveUserJwtToken = res.body.token;
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
          return request(app)
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
          return request(app)
            .post('/api/products')
            .set('Authorization', anotherJwtToken)
            .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
            .field(thirdProduct)
            .expect(httpStatus.CREATED)
            .then(res => {
              const p = res.body.data;
              expect(p.currency).toBe('UAH');
              expect(p.description).toBe(thirdProduct.description);
              expect(p.price).toBe(thirdProduct.price);
              // flow-disable-next-line
              expect(p.seller).toBe(anotherUser._id);
              expect(p.status).toBe('forsale');
              thirdProductUuid = p.uuid;
              resolve();
            })
            .catch(() => reject());
        })
      );

      Promises.push(
        new Promise((resolve, reject) => {
          return request(app)
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
      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send({ product: thirdProductUuid })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          expect(o.status).toBe('pending');
          expect(o.currency).toBe('UAH');
          expect(o.onovaFee).toBe((thirdProduct.price * 1).toString());
          expect(o.priceOfItem).toBe(thirdProduct.price);
          expect(o.transactionStatus).toBe('pl-pending');
        });
    });

    it('should not create a duplicate order for the same product', async () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send({ product: thirdProductUuid })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.order).toHaveProperty('id');
          expect(res.body.message).toContain('Duplicate order');
        });
    });

    it('should not create an order with an invalid product', async () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send({ product: '5a7ae9c687bc431aba38f9daz' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('fails to match the required');
        });
    });

    it('should not create an order if the product does not exist', async () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send({ product: 'ABCxsPOL7G' })
        .expect(httpStatus.NOT_FOUND)
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
          expect(res.body.message).toBe(
            'This product is not longer for sale or is reserved.'
          );
        });
    });

    it('should not create an order if the buyer is not verified', async () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', nonActiveUserJwtToken)
        .send({ product: productUuid })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'Please verify your account before buying a product.'
          );
        });
    });

    it('should not create an order to my own product', async () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', jwtToken)
        .send({ product: productUuid })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('You cannot buy your own items');
        });
    });
  });

  describe('# GET /api/orders', () => {
    const productGET1 = {
      categoryIds: [1],
      typeIds: [1, 2],
      description: 'nice bo0ts',
      price: '900.99',
    };
    let productGET1_uuid;
    const productGET2 = {
      categoryIds: [1],
      typeIds: [1],
      description: 'shiny shoes',
      price: '440.99',
    };
    let productGET2_uuid;
    let orderGET1;

    beforeAll(done => {
      let Promises = [];
      Promises.push(
        new Promise((resolve, reject) => {
          request(app)
            .post('/api/products')
            .set('Authorization', anotherJwtToken)
            .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
            .field(productGET1)
            .expect(httpStatus.CREATED)
            .then(res => {
              const p = res.body.data;
              expect(p.description).toBe(productGET1.description);
              expect(p.price).toBe(productGET1.price);
              // flow-disable-next-line
              expect(p.seller).toBe(anotherUser._id);
              productGET1_uuid = p.uuid;
              return productGET1_uuid;
            })
            .then(p_uuid => {
              request(app)
                .post('/api/orders')
                .set('Authorization', jwtToken)
                .send({ product: p_uuid })
                .expect(httpStatus.CREATED)
                .then(res => {
                  const o = res.body.data;
                  expect(o.onovaFee).toBe((productGET1.price * 1).toString());
                  expect(o.priceOfItem).toBe(productGET1.price);
                  orderGET1 = o.id;
                  resolve();
                });
            })
            .catch(e => reject(e));
        })
      );

      Promises.push(
        new Promise((resolve, reject) => {
          request(app)
            .post('/api/products')
            .set('Authorization', jwtToken)
            .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
            .field(productGET2)
            .expect(httpStatus.CREATED)
            .then(res => {
              const p = res.body.data;
              expect(p.description).toBe(productGET2.description);
              // flow-disable-next-line
              expect(p.seller).toBe(user._id);
              productGET2_uuid = p.uuid;
              return productGET2_uuid;
            })
            .then(p_uuid => {
              request(app)
                .post('/api/orders')
                .set('Authorization', anotherJwtToken)
                .send({ product: p_uuid })
                .expect(httpStatus.CREATED)
                .then(res => {
                  const o = res.body.data;
                  expect(o.onovaFee).toBe((productGET2.price * 1).toString());
                  expect(o.priceOfItem).toBe(productGET2.price);
                  // orderGET2 = o.id;
                  resolve();
                });
            })
            .catch(e => reject(e));
        })
      );

      Promise.all(Promises)
        .then(() => {
          done();
        })
        .catch(err => {
          console.error(err);
          done(err);
        });
    });

    it('should get my order', async () => {
      return request(app)
        .get(`/api/orders/${orderGET1}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          expect(o.id).toBe(orderGET1);
          expect(o.status).toBe('pending');
          expect(o.currency).toBe('UAH');
          expect(o.onovaFee).toBe((productGET1.price * 1).toString());
          expect(o.priceOfItem).toBe(productGET1.price);
          expect(o.transactionStatus).toBe('pl-pending');
        });
    });

    it('should not get an order that`s not mine', async () => {
      return request(app)
        .get(`/api/orders/${orderGET1}`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Unauthorized');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should get my orders (as seller and buyer)', async () => {
      return request(app)
        .get('/api/orders/?of=both')
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Array.isArray(o));
          expect(o.length).toBe(3);
        });
    });

    it('should not get other people`s orders (as seller and buyer)', async () => {
      return request(app)
        .get('/api/orders')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Array.isArray(o));
          expect(o.length).toBe(3);
        });
    });
  });

  describe('# PUT /api/orders', () => {
    const productPOST1 = {
      categoryIds: [2],
      typeIds: [1, 3],
      description: 'best bo0ts',
      price: '1900.59',
    };
    const productPOST2 = {
      categoryIds: [2],
      typeIds: [1],
      description: 'my old panties',
      price: '99900.59',
    };
    let productPOST1_uuid;
    let productPOST2_uuid;
    let orderPOST1;
    let orderPOST2;

    beforeAll(done => {
      let Promises = [];
      Promises.push(
        new Promise((resolve, reject) => {
          return request(app)
            .post('/api/products')
            .set('Authorization', anotherJwtToken)
            .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
            .field(productPOST1)
            .expect(httpStatus.CREATED)
            .then(res => {
              const p = res.body.data;
              expect(p.description).toBe(productPOST1.description);
              // flow-disable-next-line
              expect(p.seller).toBe(anotherUser._id);
              productPOST1_uuid = p.uuid;
              return productPOST1_uuid;
            })
            .then(p_uuid => {
              return request(app)
                .post('/api/orders')
                .set('Authorization', jwtToken)
                .send({ product: p_uuid })
                .expect(httpStatus.CREATED)
                .then(res => {
                  const o = res.body.data;
                  expect(o.onovaFee).toBe((productPOST1.price * 1).toString());
                  expect(o.priceOfItem).toBe(productPOST1.price);
                  orderPOST1 = o.id;
                  resolve();
                });
            })
            .catch(() => reject());
        })
      );

      Promises.push(
        new Promise((resolve, reject) => {
          return request(app)
            .post('/api/products')
            .set('Authorization', jwtToken)
            .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
            .field(productPOST2)
            .expect(httpStatus.CREATED)
            .then(res => {
              const p = res.body.data;
              expect(p.description).toBe(productPOST2.description);
              // flow-disable-next-line
              expect(p.seller).toBe(user._id);
              productPOST2_uuid = p.uuid;
              return productPOST2_uuid;
            })
            .then(p_uuid => {
              return request(app)
                .post('/api/orders')
                .set('Authorization', anotherJwtToken)
                .send({ product: p_uuid })
                .expect(httpStatus.CREATED)
                .then(res => {
                  const o = res.body.data;
                  expect(o.onovaFee).toBe((productPOST2.price * 1).toString());
                  expect(o.priceOfItem).toBe(productPOST2.price);
                  orderPOST2 = o.id;
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

    it('should set an order status to `purchased`', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', jwtToken)
        .send({ status: 'purchased' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(
            [...orderFields, 'datePurchased'].sort()
          );
          expect(o.priceOfItem).toBe(productPOST1.price);
          expect(o.status).toBe('purchased');
        });
    });

    it('should not update an order that`s not mine', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST2}`)
        .set('Authorization', jwtToken)
        .send({ status: 'purchased' })
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Unauthorized');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should not update an invalid order', async () => {
      return request(app)
        .put('/api/orders/BJCxsPOLGBJCxsPOLG')
        .set('Authorization', jwtToken)
        .send({ status: 'purchased' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Invalid order');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should set an order status to `shipped`', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', jwtToken)
        .send({ status: 'shipped' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(
            [...orderFields, 'datePurchased', 'dateShipped'].sort()
          );
          expect(o.priceOfItem).toBe(productPOST1.price);
          expect(o.status).toBe('shipped');
        });
    });

    it('should set an order status to `completed`', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', jwtToken)
        .send({ status: 'completed' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(
            [
              ...orderFields,
              'datePurchased',
              'dateShipped',
              'dateCompleted',
            ].sort()
          );
          expect(o.priceOfItem).toBe(productPOST1.price);
          expect(o.status).toBe('completed');
        });
    });

    it('should set an order status to `cancelled`', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST2}`)
        .set('Authorization', anotherJwtToken)
        .send({ status: 'cancelled' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          expect(o.priceOfItem).toBe(productPOST2.price);
          expect(o.status).toBe('cancelled');
        });
    });

    it('should not set an order status from `cancelled` to `shipped`, etc.', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST2}`)
        .set('Authorization', anotherJwtToken)
        .send({ status: 'shipped' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'cannot change the status of an order once is cancelled'
          );
          expect(res.body.ok).toBe(false);
        });
    });

    it('should not set an order to `purchased` if it was already `shipped`, `completed` or `cancelled`', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', jwtToken)
        .send({ status: 'purchased' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'cannot set an order status to purchased if its not pending first'
          );
          expect(res.body.ok).toBe(false);
        });
    });

    it('should not set an order to an invalid status', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', jwtToken)
        .send({ status: 'purchasedz' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"status" must be one of [pending, purchased, shipped, completed, cancelled]'
          );
          expect(res.body.ok).toBe(false);
        });
    });

    it('should change the paymentMethod to `paypal`', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', jwtToken)
        .send({ paymentMethod: 'paypal' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(
            [
              ...orderFields,
              'datePurchased',
              'dateShipped',
              'dateCompleted',
              'paymentMethod',
            ].sort()
          );
          expect(o.priceOfItem).toBe(productPOST1.price);
          expect(o.paymentMethod).toBe('paypal');
        });
    });

    it('should not change the paymentMethod if invalid', async () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', jwtToken)
        .send({ paymentMethod: 'paypalz' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"paymentMethod" must be one of [paypal, liqpay]'
          );
          expect(res.body.ok).toBe(false);
        });
    });
  });
});
