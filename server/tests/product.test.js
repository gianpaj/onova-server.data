import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';

import Verification from '../models/verification.model';
import User from '../models/user.model';
import Product from '../models/product.model';

// should only return these fields
const productFields = [
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

describe('## Product APIs', () => {
  beforeAll(done => {
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
    categoryIds: [1, 2, 3],
    typeIds: [1, 2, 3],
    // tags: 'tags', //optional
    description: 'nice boots',
    // seller comes after the user is created
    price: '100.99', // if no decimal points .00 will be added
  };

  let anotherProduct = {
    categoryIds: [1, 3], // @todo fix if only one category
    typeIds: [1, 3],
    description: 'nice jacket',
    price: '230.99',
  };

  let productUuid;

  beforeAll(done => {
    // create user (seller)
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
            expect(res.text).toContain('Account activated');
            done();
          });
      });
  });

  describe('# POST /api/products', () => {
    it('should create product', async () => {
      return request(app)
        .post('/api/products')
        .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .field(product)
        .expect(httpStatus.CREATED)
        .then(res => {
          const p = res.body.data;
          expect(p.categoryIds.sort()).toEqual([1, 2, 3]);
          expect(Array.isArray(p.comments));
          expect(p.comments).toEqual(expect.arrayContaining([]));
          expect(p.currency).toBe('UAH');
          expect(p.description).toBe(product.description);
          expect(Array.isArray(p.likes));
          expect(p.likes).toEqual(expect.arrayContaining([]));
          expect(p.photoURIs).toHaveLength(2);
          expect(p.price).toBe(product.price);
          expect(p.seller).toBe(product.seller);
          expect(p.status).toBe('forsale');
          expect(Array.isArray(p.tags));
          expect(p.tags).toEqual(expect.arrayContaining([]));
          expect(p.typeIds.sort()).toEqual([1, 2, 3]);
          expect(Object.keys(p).sort()).toEqual(productFields.sort());
          productUuid = p.uuid;
        });
    });

    it('should not create product with wrong file uploaded', async () => {
      return request(app)
        .post('/api/products')
        .attach('photos', path.join(__dirname, 'misc.test.js'))
        .field(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain(
            'File upload only supports the following filetypes'
          );
        });
    });

    it('should not create product without uploading a photo', async () => {
      return request(app)
        .post('/api/products')
        .field(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Product image(s) are required');
        });
    });

    it('should not create product without a valid seller', async () => {
      return request(app)
        .post('/api/products')
        .field({ ...product, seller: '5a1b50bfa4c57109cf583235' })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Seller not found');
        });
    });
  });

  describe('# GET /api/products/:uuid', () => {
    it('should get an existing product', async () => {
      return request(app)
        .get(`/api/products/${productUuid}`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(p.description).toBe(product.description);
          expect(p.seller._id).toBe(product.seller);
          expect(p.status).toBe('forsale');
          expect(p.currency).toBe('UAH');
          expect(Array.isArray(p.likes));
          expect(p.likes).toEqual(expect.arrayContaining([]));
          expect(Array.isArray(p.comments));
          expect(p.comments).toEqual(expect.arrayContaining([]));
          expect(Array.isArray(p.tags));
          expect(p.tags).toEqual(expect.arrayContaining([]));
          expect(p.typeIds.sort()).toEqual([1, 2, 3]);
          expect(p.categoryIds.sort()).toEqual([1, 2, 3]);
          expect(p.photoURIs).toHaveLength(2);
        });
    });

    it('should not get an non valid product', async () => {
      return request(app)
        .get('/api/products/SkveMe9lz')
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Invalid product');
        });
    });
  });

  describe('# GET /api/products/', () => {
    beforeAll(done => {
      anotherProduct.seller = product.seller;
      request(app)
        .post('/api/products')
        .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
        .field(anotherProduct)
        .expect(httpStatus.CREATED)
        .then(res => {
          expect(typeof res.body.data).toBe('object');
          done();
        });
    });

    it('should get 2 products', async () => {
      return request(app)
        .get(`/api/products/`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p.length).toBe(2);
          expect(Object.keys(p[0]).sort()).toEqual(productFields.sort());
        });
    });

    it('should get only the last product', async () => {
      return request(app)
        .get(`/api/products/?limit=1`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p.length).toBe(1);
          expect(p[0].description).toBe(anotherProduct.description);
        });
    });

    it('should get only the first product', async () => {
      return request(app)
        .get(`/api/products/?limit=1?&skip=1`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p.length).toBe(1);
          expect(p[0].description).toBe(product.description);
        });
    });
  });
});
