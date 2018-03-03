// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';
import Follow from '../models/follow.model';
import Tag from '../models/tag.model';
import User from '../models/user.model';
import Product from '../models/product.model';
import Verification from '../models/verification.model';
import { createProduct } from './product.test';

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
  'categoryIds',
  'comments',
  'createdAt',
  'currency',
  'description',
  'likes',
  'photoURIs',
  'price',
  'seller',
  'status',
  'tags',
  'typeIds',
  'updatedAt',
  'uuid',
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

let notForSaleProduct = {
  categoryIds: [2],
  typeIds: [1, 3],
  tags: ['WINTER'],
  description: 'nice scarf',
  price: '30',
};

let userId;
let anotherUserId;
let thirdUserId;
let productUuid;
let anotherProductUuid;
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
      Product.collection,
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
              });
          });
      })
      .then(async () => {
        const p1 = await createProduct(anotherProduct, jwtToken);
        expect(p1.description).toBe(anotherProduct.description);
        productUuid = p1.uuid;
      })
      .then(async () => {
        const p2 = await createProduct(anotherProduct, anotherJwtToken);
        expect(p2.description).toBe(anotherProduct.description);
        anotherProductUuid = p2.uuid;
      })
      .then(async () => {
        const p3 = await createProduct(anotherProduct, anotherJwtToken);
        expect(p3.description).toBe(anotherProduct.description);
        request(app)
          .delete(`/api/products/${p3.uuid}`)
          .set('Authorization', anotherJwtToken)
          .expect(httpStatus.NO_CONTENT)
          .then(res => {
            expect(res.body).toMatchObject({});
            done();
          });
      });
  });

  describe('# GET /api/feed/flat', () => {
    // both accounts follow each other
    beforeAll(done => {
      let Promises = [];
      Promises.push(
        new Promise((resolve, reject) => {
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
              resolve();
            })
            .catch(e => reject(e));
        })
      );
      Promises.push(
        new Promise((resolve, reject) => {
          request(app)
            .post(`/api/users/${userId}/follow`)
            .set('Authorization', anotherJwtToken)
            .expect(httpStatus.CREATED)
            .then(res => {
              const { data } = res.body;
              expect(data.follower).toBe(anotherUserId);
              expect(data.following).toBe(userId);
              expect(Object.keys(data).sort()).toEqual(
                ['follower', 'following', 'dateCreated'].sort()
              );
              resolve();
            })
            .catch(e => reject(e));
        })
      );
      Promise.all(Promises)
        .then(() => done())
        .catch(e => {
          throw e;
        });
    });

    it('should get the first user`s feed', async () => {
      return request(app)
        .get('/api/feed/flat')
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].uuid).toBe(anotherProductUuid);
          expect(Object.keys(data[0]).sort()).toEqual(feedFields.sort());
          expect(data).toHaveLength(1);
        });
    });

    it('should get another user`s feed', async () => {
      return request(app)
        .get('/api/feed/flat')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].uuid).toBe(productUuid);
          expect(data).toHaveLength(1);
        });
    });

    it('should not get my feed if i am not authenticated', async () => {
      return request(app)
        .get('/api/feed/flat')
        .expect(httpStatus.UNAUTHORIZED)
        .then();
    });
  });

  describe('# GET /api/feed/flat?categoryIds=', () => {
    let categoryProductUUID;

    beforeAll(async () => {
      const p = {
        categoryIds: [2],
        typeIds: [1, 3],
        tags: ['WINTER'],
        description: 'nice jumper',
        price: '39',
      };
      const pp = await createProduct(p, jwtToken);
      expect(pp.description).toBe(p.description);
      categoryProductUUID = pp.uuid;
    });

    it('should get feed of categoryIds', async () => {
      return request(app)
        .get('/api/feed/flat?categoryIds=2')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].uuid).toBe(categoryProductUUID);
          expect(data).toHaveLength(1);
        });
    });
  });

  describe('# GET /api/feed/flat?typeIds=', () => {
    let typeIdProductUUID;

    beforeAll(async () => {
      const p = {
        categoryIds: [1],
        typeIds: [1, 5],
        tags: ['WINTER'],
        description: 'nice hoodie',
        price: '69',
      };
      const pp = await createProduct(p, jwtToken);
      expect(pp.description).toBe(p.description);
      typeIdProductUUID = pp.uuid;
    });

    it('should get feed of typeIds', async () => {
      return request(app)
        .get('/api/feed/flat?typeIds=5')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].uuid).toBe(typeIdProductUUID);
          expect(data).toHaveLength(1);
        });
    });
  });

  describe('# GET /api/feed/flat?tag=', () => {
    let tagProductUUID;

    beforeAll(async () => {
      const p = {
        categoryIds: [2],
        typeIds: [1, 4],
        tags: ['warm'],
        description: 'nice socks',
        price: '19',
      };
      const pp = await createProduct(p, jwtToken);
      expect(pp.description).toBe(p.description);
      tagProductUUID = pp.uuid;
    });

    it('should get feed of tag', async () => {
      return request(app)
        .get('/api/feed/flat?tag=warm')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].uuid).toBe(tagProductUUID);
          expect(data).toHaveLength(1);
        });
    });
  });
});
