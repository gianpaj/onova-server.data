// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import Follow from '../models/follow.model';
import Tag from '../models/tag.model';
import User from '../models/user.model';
import Product from '../models/product.model';
import Verification from '../models/verification.model';
import { createProduct, createUserAndLogin, createManyProducts } from './utils';

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
  '_id',
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

const product = {
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

const notForSaleProduct = {
  categoryIds: [2],
  typeIds: [1, 3],
  tags: ['WINTER'],
  description: 'nice scarf',
  price: '30',
};

let userId;
let anotherUserId;
let productUuid;
let anotherProductUuid;
let firstJwtToken;
let anotherJwtToken;

describe('## Feed APIs', () => {
  beforeAll(done => {
    const collections = [
      Follow.collection,
      Product.collection,
      Tag.collection,
      User.collection,
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

  // create 2 users/sellers + 2 products
  beforeAll(done => {
    createUserAndLogin(user)
      .then(({ user, jwtToken }) => {
        userId = user._id;
        firstJwtToken = jwtToken;
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(() => {
        return createUserAndLogin(anotherUser).then(({ user, jwtToken }) => {
          anotherUserId = user._id;
          anotherJwtToken = jwtToken;
        });
      })
      .then(async () => {
        const p1 = await createProduct(product, firstJwtToken);
        expect(p1.description).toBe(product.description);
        productUuid = p1.uuid;
      })
      .then(async () => {
        const p2 = await createProduct(anotherProduct, anotherJwtToken);
        expect(p2.description).toBe(anotherProduct.description);
        anotherProductUuid = p2.uuid;
      })
      .then(async () => {
        const p3 = await createProduct(notForSaleProduct, anotherJwtToken);
        expect(p3.description).toBe(notForSaleProduct.description);
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

  // both accounts follow each other
  beforeAll(done => {
    let Promises = [];
    Promises.push(
      new Promise((resolve, reject) => {
        request(app)
          .post(`/api/users/${anotherUserId}/follow`)
          .set('Authorization', firstJwtToken)
          .expect(httpStatus.CREATED)
          .then(res => resolve())
          .catch(e => reject(e));
      })
    );
    Promises.push(
      new Promise((resolve, reject) => {
        request(app)
          .post(`/api/users/${userId}/follow`)
          .set('Authorization', anotherJwtToken)
          .expect(httpStatus.CREATED)
          .then(res => resolve())
          .catch(e => reject(e));
      })
    );
    Promise.all(Promises)
      .then(() => done())
      .catch(e => {
        throw e;
      });
  });

  describe('# GET /api/feed/flat', () => {
    it('should get the first user`s feed', () => {
      return request(app)
        .get('/api/feed/flat')
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].uuid).toBe(anotherProductUuid);
          expect(Object.keys(data[0]).sort()).toEqual(feedFields.sort());
          expect(data).toHaveLength(1);
        });
    });

    it('should get another user`s feed', () => {
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

    it('should not get my feed if i am not authenticated', () => {
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
      const pp = await createProduct(p, firstJwtToken);
      expect(pp.description).toBe(p.description);
      categoryProductUUID = pp.uuid;
    });

    it('should get feed by categoryIds', () => {
      return request(app)
        .get('/api/feed/flat?categoryIds=2')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0].uuid).toBe(categoryProductUUID);
          expect(data).toHaveLength(2);
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
      const pp = await createProduct(p, firstJwtToken);
      expect(pp.description).toBe(p.description);
      typeIdProductUUID = pp.uuid;
    });

    it('should get feed by typeIds', () => {
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
      const pp = await createProduct(p, firstJwtToken);
      expect(pp.description).toBe(p.description);
      tagProductUUID = pp.uuid;
    });

    it('should get feed of tag', () => {
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

  describe('# GET /api/feed/flat?lastId=', () => {
    // delete all Products
    beforeAll(done => {
      const collections = [Product.collection];
      var todo = collections.length;
      if (!todo) return done();

      collections.forEach(collection => {
        collection.remove({}, { safe: true }, () => {
          if (--todo === 0) done();
        });
      });
    });

    beforeAll(async () => {
      const a = await createManyProducts(105, firstJwtToken);
      if (a instanceof Error) console.error(a);
    });

    let lastId;

    it('should get feed without pagination', () => {
      return request(app)
        .get('/api/feed/flat')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data).toHaveLength(50);
          lastId = data[data.length - 1]._id;
        });
    });

    it('should get feed with load more', () => {
      return request(app)
        .get(`/api/feed/flat?lastId=${lastId}&limit=5`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0]._id).not.toBe(lastId);
          expect(data[data.length - 1]._id).not.toBe(lastId);
          expect(data).toHaveLength(5);
          lastId = data[data.length - 1]._id;
        });
    });

    it('should get feed with load more again', () => {
      return request(app)
        .get(`/api/feed/flat?lastId=${lastId}&limit=5`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data[0]._id).not.toBe(lastId);
          expect(data[data.length - 1]._id).not.toBe(lastId);
          expect(data).toHaveLength(5);
        });
    });

    it('should not get feed with load more with a missing lastId', () => {
      return request(app)
        .get(`/api/feed/flat?lastId=5ff999999147a8bd32ea35f6`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.NOT_FOUND)
        .then(res => {
          expect(res.body.message).toContain('Product not found');
        });
    });
  });
});
