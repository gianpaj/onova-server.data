// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';
// import config from '../config/config';
import Tag from '../models/tag.model';
import {
  beforeAllTests,
  createUserAndLogin,
  createProduct,
  orderFields,
} from './utils';

describe('## Order APIs', () => {
  beforeAll(beforeAllTests);

  let firstUser = {
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
    pushToken: 'anotherpersonPushToken',
    platform: 'ios',
  };

  let nonActiveUser = {
    username: 'thirdperson',
    emailAddress: 'gianpa+test3@gmail.com',
    mobileNumber: '1234567890',
    password: 'expressos',
  };

  let forthUser = {
    username: 'forthperson',
    emailAddress: 'gianpa+test4@gmail.com',
    mobileNumber: '1234567890',
    password: 'expressos4',
  };

  let productA = {
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    tags: ['winter', 'spring2007'], // optional
    description: 'nice boots',
    // seller id is the user who creates the product
    price: '100.99', // if no decimal points .00 will be added
    photos: [
      'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
    ],
  };

  let productB = {
    categoryIds: [3],
    typeIds: [1, 3],
    tags: ['summer'],
    description: 'nice flipflops',
    price: '10.99',
    photos: [
      'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
    ],
  };

  let productC = {
    categoryIds: [2],
    typeIds: [2, 3],
    description: 'nice shorts',
    price: '200.50',
    photos: [
      'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
    ],
  };

  let firstUserProductAUuid;
  let firstUserProductBUuid2;
  let anotherUserProductCUuid;
  let firstUserJwtToken;
  let anotherJwtToken;
  let nonActiveUserJwtToken;
  let forthJwtToken;
  let ordersByfirstUser = 0;
  let ordersTofirstUser = 0;
  let ordersByAnotherUser = 0;
  let ordersToAnotherUser = 0;

  // create 3 users. 1 not activated
  beforeAll(done => {
    // @TODO: use Promise.all().then(() => done());
    // $FlowFixMe
    createUserAndLogin(firstUser)
      .then(({ user: resUser, jwtToken: token }) => {
        firstUser._id = resUser._id;
        firstUserJwtToken = token;
      })
      .then(() => {
        return request(app)
          .put(`/api/users/${firstUser._id}`)
          .set('Authorization', firstUserJwtToken)
          .attach('profilePic', path.join(__dirname, 'images/profilepic.jpg'))
          .expect(httpStatus.OK);
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(() => {
        // $FlowFixMe
        return createUserAndLogin(anotherUser).then(({ user, jwtToken }) => {
          anotherUser._id = user._id;
          anotherJwtToken = jwtToken;
        });
      })
      .then(() => {
        return createUserAndLogin(forthUser).then(({ user, jwtToken }) => {
          forthUser._id = user._id;
          forthJwtToken = jwtToken;
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
            nonActiveUserJwtToken = res.body.token;
            // flow-disable-next-line
            nonActiveUser._id = resUser._id;
            done();
          });
      });
  });

  // create 3 products and delete 1 of them
  beforeAll(done => {
    let Promises = [];
    Promises.push(
      createProduct(productA, firstUserJwtToken).then(p => {
        firstUserProductAUuid = p.uuid;
      })
    );
    Promises.push(
      createProduct(productC, anotherJwtToken).then(p => {
        anotherUserProductCUuid = p.uuid;
      })
    );

    // create product and delete it
    Promises.push(
      createProduct(productB, firstUserJwtToken).then(p => {
        firstUserProductBUuid2 = p.uuid;
        return request(app)
          .delete(`/api/products/${firstUserProductBUuid2}`)
          .set('Authorization', firstUserJwtToken)
          .expect(httpStatus.NO_CONTENT)
          .then(res => {
            expect(res.body).toMatchObject({});
            ordersByfirstUser++;
          });
      })
    );

    Promise.all(Promises).then(() => {
      done();
    });
  });

  describe('# POST /api/orders', () => {
    it('should create an order', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', firstUserJwtToken)
        .send({ product: anotherUserProductCUuid })
        .expect(httpStatus.CREATED)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          expect(o.status).toBe('pending');
          expect(o.currency).toBe('UAH');
          expect(o.onovaFee).toBe((productC.price * 1).toString());
          expect(o.priceOfItem).toBe(productC.price);
          expect(o.transactionStatus).toBe('pl-pending');
          ordersToAnotherUser++;
        });
    });

    it('should NOT create a duplicate order for the same product and buyer', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', firstUserJwtToken)
        .send({ product: anotherUserProductCUuid })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.message).toContain('Duplicate order');
        });
    });

    it('should allow another buyer to order for the same product', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', forthJwtToken)
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

    it('should NOT create an order with an invalid product', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', firstUserJwtToken)
        .send({ product: '5a7ae9c687bc431aba38f9daz' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('fails to match the required');
        });
    });

    it('should NOT create an order if the product does not exist', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', firstUserJwtToken)
        .send({ product: 'ABCxsPOL7G' })
        .expect(httpStatus.NOT_FOUND)
        .then(res => {
          expect(res.body.message).toBe('Product not found');
        });
    });

    it('should NOT create an order if the product is not for sale', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', anotherJwtToken)
        .send({ product: firstUserProductBUuid2 })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'This product is not longer for sale or is reserved.'
          );
        });
    });

    it('should NOT create an order if the buyer is not verified', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', nonActiveUserJwtToken)
        .send({ product: firstUserProductAUuid })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'Please verify your account before buying a product.'
          );
        });
    });

    it('should NOT create an order to my own product', () => {
      return request(app)
        .post('/api/orders')
        .set('Authorization', firstUserJwtToken)
        .send({ product: firstUserProductAUuid })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('You cannot buy your own items');
        });
    });
  });

  describe('# GET /api/orders', () => {
    const productGET1OfAnother = {
      categoryIds: [1],
      typeIds: [1, 2],
      description: 'nice bo0ts',
      price: '900.99',
      photos: [
        'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
      ],
    };
    let orderGET1;

    const productGET2 = {
      categoryIds: [1],
      typeIds: [1],
      description: 'shiny shoes',
      price: '440.99',
      photos: [
        'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
      ],
    };

    beforeAll(done => {
      let Promises = [];
      Promises.push(
        createProduct(productGET1OfAnother, anotherJwtToken).then(product => {
          return request(app)
            .post('/api/orders')
            .set('Authorization', firstUserJwtToken)
            .send({ product: product.uuid })
            .expect(httpStatus.CREATED)
            .then(res => {
              const o = res.body.data;
              expect(o.onovaFee).toBe(
                (productGET1OfAnother.price * 1).toString()
              );
              expect(o.priceOfItem).toBe(productGET1OfAnother.price);
              orderGET1 = o.id;
              ordersByfirstUser++;
              ordersToAnotherUser++;
            });
        })
      );

      Promises.push(
        createProduct(productGET2, firstUserJwtToken).then(product => {
          return request(app)
            .post('/api/orders')
            .set('Authorization', anotherJwtToken)
            .send({ product: product.uuid })
            .expect(httpStatus.CREATED)
            .then(res => {
              const o = res.body.data;
              expect(o.onovaFee).toBe((productGET2.price * 1).toString());
              expect(o.priceOfItem).toBe(productGET2.price);
              // orderGET2 = o.id;
              ordersByAnotherUser++;
              ordersTofirstUser++;
            });
        })
      );

      Promise.all(Promises)
        .then(() => done())
        .catch(err => {
          console.error(err);
          done(err);
        });
    });

    it('should get my order', () => {
      return request(app)
        .get(`/api/orders/${orderGET1}`)
        .set('Authorization', firstUserJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          expect(o.id).toBe(orderGET1);
          expect(o.status).toBe('pending');
          expect(o.currency).toBe('UAH');
          expect(o.onovaFee).toBe((productGET1OfAnother.price * 1).toString());
          expect(o.priceOfItem).toBe(productGET1OfAnother.price);
          expect(o.transactionStatus).toBe('pl-pending');
        });
    });

    it('should NOT get an order that`s not mine', () => {
      return request(app)
        .get(`/api/orders/${orderGET1}`)
        .set('Authorization', forthJwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Unauthorized');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should get my order as a seller', () => {
      return request(app)
        .get(`/api/orders/${orderGET1}`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(orderFields.sort());
          expect(o.id).toBe(orderGET1);
          expect(o.status).toBe('pending');
          expect(o.currency).toBe('UAH');
          expect(o.onovaFee).toBe((productGET1OfAnother.price * 1).toString());
          expect(o.priceOfItem).toBe(productGET1OfAnother.price);
          expect(o.transactionStatus).toBe('pl-pending');
        });
    });

    it('should get my orders (as seller and buyer)', () => {
      return request(app)
        .get('/api/orders')
        .set('Authorization', firstUserJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Array.isArray(o));
          expect(o.length).toBe(ordersByfirstUser + ordersTofirstUser);
          expect(Object.keys(o[0]).sort()).toEqual(orderFields.sort());
          expect(Object.keys(o[0].buyer).sort()).toEqual(
            ['_id', 'accountStatus', 'profilePic', 'username'].sort()
          );
          // this user didn't upload the profilePic
          expect(Object.keys(o[0].seller).sort()).toEqual(
            ['_id', 'accountStatus', 'username'].sort()
          );
        });
    });

    it('should NOT get other people`s orders (as seller and buyer)', () => {
      return request(app)
        .get('/api/orders')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Array.isArray(o));
          expect(Object.keys(o[0]).sort()).toEqual(orderFields.sort());
          expect(o.length).toBe(ordersByAnotherUser + ordersToAnotherUser);
        });
    });
  });

  describe('# PUT /api/orders', () => {
    const productPOST1 = {
      categoryIds: [2],
      typeIds: [1, 3],
      description: 'best bo0ts',
      price: '1900.59',
      photos: [
        'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
      ],
    };
    const productPOST2 = {
      categoryIds: [2],
      typeIds: [1],
      description: 'my old panties',
      price: '99900.59',
      photos: [
        'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
      ],
    };
    let orderPOST1;
    let orderPOST2;

    beforeAll(done => {
      let Promises = [];
      Promises.push(
        createProduct(productPOST1, anotherJwtToken).then(product => {
          return request(app)
            .post('/api/orders')
            .set('Authorization', firstUserJwtToken)
            .send({ product: product.uuid })
            .expect(httpStatus.CREATED)
            .then(res => {
              const o = res.body.data;
              expect(o.onovaFee).toBe((productPOST1.price * 1).toString());
              expect(o.priceOfItem).toBe(productPOST1.price);
              orderPOST1 = o.id;
            });
        })
      );

      Promises.push(
        createProduct(productPOST2, firstUserJwtToken).then(product => {
          return request(app)
            .post('/api/orders')
            .set('Authorization', anotherJwtToken)
            .send({ product: product.uuid })
            .expect(httpStatus.CREATED)
            .then(res => {
              const o = res.body.data;
              expect(o.onovaFee).toBe((productPOST2.price * 1).toString());
              expect(o.priceOfItem).toBe(productPOST2.price);
              orderPOST2 = o.id;
            });
        })
      );

      Promise.all(Promises).then(() => {
        done();
      });
    });

    it('should NOT cancel an order that`s not mine', () => {
      return request(app)
        .put(`/api/orders/${orderPOST2}`)
        .set('Authorization', forthJwtToken)
        .send({ status: 'cancelled' })
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Unauthorized');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should NOT cancel an invalid order', () => {
      return request(app)
        .put('/api/orders/BJCxsPOLGBJCxsPOLG')
        .set('Authorization', firstUserJwtToken)
        .send({ status: 'cancelled' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Invalid order');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should NOT set an order status to `shipped`', () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', firstUserJwtToken)
        .send({ status: 'shipped' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"status" must be one of [confirmed, cancelled]'
          );
          expect(res.body.ok).toBe(false);
        });
    });

    it('should NOT allow the seller to cancel the order without a reason', () => {
      return request(app)
        .put(`/api/orders/${orderPOST2}`)
        .set('Authorization', firstUserJwtToken)
        .send({ status: 'cancelled' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('"reason" is required');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should allow the seller to cancel the order', () => {
      return request(app)
        .put(`/api/orders/${orderPOST2}`)
        .set('Authorization', firstUserJwtToken)
        .send({ status: 'cancelled', reason: 'it`s already sold' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(
            [...orderFields, 'dateCancelled', 'reason'].sort()
          );
          expect(o.priceOfItem).toBe(productPOST2.price);
          expect(o.status).toBe('cancelled');
          expect(o.reason).toBe('it`s already sold');
        });
    });

    it('should NOT set an order status from `cancelled` to `shipped`, etc.', () => {
      return request(app)
        .put(`/api/orders/${orderPOST2}`)
        .set('Authorization', anotherJwtToken)
        .send({ status: 'shipped' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"status" must be one of [confirmed, cancelled]'
          );
          expect(res.body.ok).toBe(false);
        });
    });

    it('should NOT set an order to an invalid status', () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', firstUserJwtToken)
        .send({ status: 'paidz' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"status" must be one of [confirmed, cancelled]'
          );
          expect(res.body.ok).toBe(false);
        });
    });

    it('should change the paymentMethod to `paypal`', () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', firstUserJwtToken)
        .send({ paymentMethod: 'paypal' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          // TODO: after payment is tested it should return 'datePaid'
          expect(Object.keys(o).sort()).toEqual(
            [...orderFields, 'paymentMethod'].sort()
          );
          expect(o.priceOfItem).toBe(productPOST1.price);
          expect(o.paymentMethod).toBe('paypal');
        });
    });

    it('should NOT change the paymentMethod if invalid', () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', firstUserJwtToken)
        .send({ paymentMethod: 'paypalz' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            '"paymentMethod" must be one of [paypal, liqpay]'
          );
          expect(res.body.ok).toBe(false);
        });
    });

    it('should NOT archive an order and change status', () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', firstUserJwtToken)
        .send({ archive: true, status: 'cancelled' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'cannot change the status and archive at the same time'
          );
        });
    });

    it('should archive an order (as buyer)', () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', firstUserJwtToken)
        .send({ archive: true })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(o.priceOfItem).toBe(productPOST1.price);
          expect(o.archivedByBuyer).toBe(true);
        });
    });

    it('should archive an order (as seller)', () => {
      return request(app)
        .put(`/api/orders/${orderPOST1}`)
        .set('Authorization', anotherJwtToken)
        .send({ archive: true })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(o.priceOfItem).toBe(productPOST1.price);
          expect(o.archivedByBuyer).toBe(true);
        });
    });
  });

  describe('# PUT /api/orders (more)', () => {
    const productPOST2 = {
      categoryIds: [2],
      typeIds: [1],
      description: 'my old panties',
      price: '99900.59',
      photos: [
        'https://storage.googleapis.com/temp-uploads.onova.co/1533146500579-.jpeg',
      ],
    };
    let orderPOST3;
    let orderPOST4;

    beforeAll(done => {
      let Promises = [];

      Promises.push(
        createProduct(productPOST2, firstUserJwtToken).then(product => {
          return request(app)
            .post('/api/orders')
            .set('Authorization', anotherJwtToken)
            .send({ product: product.uuid })
            .expect(httpStatus.CREATED)
            .then(res => {
              const o = res.body.data;
              expect(o.onovaFee).toBe((productPOST2.price * 1).toString());
              expect(o.priceOfItem).toBe(productPOST2.price);
              orderPOST3 = o.id;
            });
        })
      );
      Promises.push(
        createProduct(productPOST2, firstUserJwtToken).then(product => {
          return request(app)
            .post('/api/orders')
            .set('Authorization', anotherJwtToken)
            .send({ product: product.uuid })
            .expect(httpStatus.CREATED)
            .then(res => {
              const o = res.body.data;
              expect(o.onovaFee).toBe((productPOST2.price * 1).toString());
              expect(o.priceOfItem).toBe(productPOST2.price);
              orderPOST4 = o.id;
            });
        })
      );

      Promise.all(Promises).then(() => {
        done();
      });
    });

    it('should allow the buyer set an order status to `cancelled`', () => {
      return request(app)
        .put(`/api/orders/${orderPOST3}`)
        .set('Authorization', anotherJwtToken)
        .send({ status: 'cancelled' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(
            [...orderFields, 'dateCancelled'].sort()
          );
          expect(o.priceOfItem).toBe(productPOST2.price);
          expect(o.status).toBe('cancelled');
        });
    });

    it('should NOT allow the buyer set an order status to `confirmed` (confirm)', () => {
      return request(app)
        .put(`/api/orders/${orderPOST4}`)
        .set('Authorization', anotherJwtToken)
        .send({ status: 'confirmed' })
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Unauthorized');
          expect(res.body.ok).toBe(false);
        });
    });

    it('should allow the seller set an order status to `confirmed` (confirm)', () => {
      return request(app)
        .put(`/api/orders/${orderPOST4}`)
        .set('Authorization', firstUserJwtToken)
        .send({ status: 'confirmed' })
        .expect(httpStatus.OK)
        .then(res => {
          const o = res.body.data;
          expect(Object.keys(o).sort()).toEqual(
            [...orderFields, 'dateConfirmed'].sort()
          );
          expect(o.priceOfItem).toBe(productPOST2.price);
          expect(o.status).toBe('confirmed');
        });
    });
  });
});
