// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';

import Verification from '../models/verification.model';
import User from '../models/user.model';
import Tag from '../models/tag.model';
import Product from '../models/product.model';
import { createProduct, createUserAndLogin, productFields } from './utils';

// jest.mock('@google-cloud/storage');

describe('## Product APIs', () => {
  beforeAll(done => {
    const collections = [
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

  let user = {
    username: 'firstperson',
    emailAddress: 'gianpa+test@gmail.com',
    mobileNumber: '1234567890', // optional
    // displayName: 'first user',
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
    // seller comes after the user is created
    price: '100.99', // if no decimal points .00 will be added
  };

  let anotherProduct = {
    categoryIds: [1],
    typeIds: [1, 3],
    description: 'nice jacket',
    price: '230.99',
  };

  let thirdProduct = {
    categoryIds: [2],
    typeIds: [1, 3],
    tags: ['WINTER'],
    description: 'nice scarf',
    price: '30',
  };

  let badProduct = {
    categoryIds: [2],
    typeIds: [1, 3],
    tags: ['lol@'],
    description: 'nice API',
    price: '290.00',
  };

  let productUuid;
  let jwtToken;
  let anotherJwtToken;
  let anotherProdUuid;
  let thirdProdUuid;

  let productsCounter = 0;

  // create 2 users/sellers + Tag and upload profile pic of a seller
  beforeAll(done => {
    createUserAndLogin(user)
      .then(({ user: resUser, jwtToken: token }) => {
        user._id = resUser._id;
        jwtToken = token;
      })
      .then(async () => {
        return request(app)
          .put(`/api/users/${user._id}`)
          .set('Authorization', jwtToken)
          .attach('profilePic', path.join(__dirname, 'images/profilepic.jpg'))
          .expect(httpStatus.OK);
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(() => {
        return createUserAndLogin(anotherUser).then(
          ({ user: resUser, jwtToken: token }) => {
            anotherUser._id = resUser._id;
            anotherJwtToken = token;
            done();
          }
        );
      });
  });

  describe('# POST /api/products', () => {
    it('should create a product', async () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .field(product)
        .expect(httpStatus.CREATED)
        .then(res => {
          const p = res.body.data;
          expect(p.categoryIds.sort()).toEqual([1, 2, 3]);
          expect(Array.isArray(p.comments));
          expect(p.comments).toHaveLength(0);
          expect(p.currency).toBe('UAH');
          expect(p.description).toBe(product.description);
          expect(Array.isArray(p.likes));
          expect(p.likes).toHaveLength(0);
          expect(p.photoURIs).toEqual([]);
          expect(p.price).toBe(product.price);
          // flow-disable-next-line
          expect(p.seller).toBe(user._id);
          expect(p.status).toBe('forsale');
          expect(Array.isArray(p.tags));
          expect(p.tags).toEqual(product.tags);
          expect(p.typeIds.sort()).toEqual([1, 2, 3]);
          expect(Object.keys(p).sort()).toEqual(
            [...productFields, 'comments'].sort()
          );
          productUuid = p.uuid;
          productsCounter++;
        });
    });

    it('should not create product with wrong file uploaded', async () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
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
        .set('Authorization', jwtToken)
        .field(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Product image(s) are required');
        });
    });

    it('should not create product with an invalid tag (with @)', async () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field(badProduct)
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain(
            'fails to match the required pattern'
          );
        });
    });

    it('should not create product with an invalid tag (with space)', async () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...badProduct, tags: ['my pony'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain(
            'fails to match the required pattern'
          );
        });
    });

    it('should not create product with an invalid tag (with .)', async () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...badProduct, tags: ['lol.pony'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain(
            'fails to match the required pattern'
          );
        });
    });

    it('should create product with a valid tag (start with numbers)', async () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...product, tags: ['111pony'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.CREATED)
        .then(() => void productsCounter++);
    });

    it('should create product with a valid tag (cyrilic)', async () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...product, tags: ['плнаше'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.CREATED)
        .then(() => void productsCounter++);
    });

    it('should not create product without a proper price', async () => {
      badProduct.tags = ['winter'];
      badProduct.price = '0';
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field(badProduct)
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain(
            '"price" contains an invalid value'
          );
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
          // flow-disable-next-line
          expect(p.seller._id).toBe(user._id);
          expect(p.seller.username).toBe(user.username);
          expect(Object.keys(p.seller).sort()).toEqual(
            ['_id', 'accountStatus', 'id', 'profilePic', 'username'].sort()
          );
          expect(p.seller.profilePic).toContain('profilepic.jpg');
          expect(p.status).toBe('forsale');
          expect(p.currency).toBe('UAH');
          expect(Array.isArray(p.likes));
          expect(p.likes).toHaveLength(0);
          expect(Array.isArray(p.comments));
          // expect(p.comments).toHaveLength(0);
          expect(Array.isArray(p.tags));
          expect(p.tags).toHaveLength(2);
          expect(p.typeIds.sort()).toEqual([1, 2, 3]);
          expect(p.categoryIds.sort()).toEqual([1, 2, 3]);
          expect(p.photoURIs).toHaveLength(0);
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
    beforeAll(async () => {
      const p1 = await createProduct(anotherProduct, jwtToken);
      expect(typeof p1).toBe('object');
      const p2 = await createProduct(thirdProduct, jwtToken);
      expect(p2.tags).toEqual(expect.arrayContaining(thirdProduct.tags));
      expect(p2.tags).toHaveLength(1);
      expect(typeof p2).toBe('object');
      productsCounter++;
      productsCounter++;
    });

    it('should get all products', async () => {
      return request(app)
        .get('/api/products/')
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(productsCounter);
          expect(Object.keys(p[0]).sort()).toEqual(productFields.sort());
        });
    });

    it('should get only the last product', async () => {
      return request(app)
        .get('/api/products/?limit=1')
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(1);
          expect(p[0].description).toBe(thirdProduct.description);
        });
    });

    it('should get only the first product', async () => {
      return request(app)
        .get('/api/products/?limit=1&skip=2')
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(1);
          expect(p[0].description).toBe(product.description);
        });
    });

    it("should get only the user's products by userid", async () => {
      return request(app)
        .get(`/api/products/?userid=${user._id}`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(productsCounter);
          expect(Object.keys(p[0]).sort()).toEqual(productFields.sort());
        });
    });

    it("should get only the user's products by username", async () => {
      return request(app)
        .get(`/api/products/?username=${user.username}`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(productsCounter);
          expect(Object.keys(p[0]).sort()).toEqual(productFields.sort());
        });
    });

    it("should not get only user's products by non existant username", async () => {
      return request(app)
        .get(`/api/products/?username=banana`)
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('# GET /api/products/?tags=', () => {
    it('should find all winter products', async () => {
      return request(app)
        .get('/api/products/?tags=winter')
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(1);
          expect(p[0].description).toBe(product.description);
        });
    });
  });

  describe('# DELETE /api/products/:uuid', () => {
    it('should delete an existing product', async () => {
      return request(app)
        .delete(`/api/products/${productUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.NO_CONTENT)
        .then(res => {
          expect(res.body).toMatchObject({});
          productsCounter--;
        });
    });

    it('should get all remaining products', async () => {
      return request(app)
        .get('/api/products/')
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(productsCounter);
          expect(Object.keys(p[0]).sort()).toEqual(productFields.sort());
        });
    });

    it('should not delete a deleted product', async () => {
      return request(app)
        .delete(`/api/products/${productUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body).toMatchObject({});
        });
    });

    describe('create another product', () => {
      beforeAll(async () => {
        const p = await createProduct(anotherProduct, anotherJwtToken);
        anotherProdUuid = p.uuid;
      });

      it('should not delete a product which is not mine', async () => {
        return request(app)
          .delete(`/api/products/${anotherProdUuid}`)
          .set('Authorization', jwtToken)
          .expect(httpStatus.UNAUTHORIZED)
          .then(res => {
            expect(res.body.message).toBe('Unauthorized');
          });
      });
    });
  });

  describe('# UPDATE /api/products/:uuid', () => {
    beforeAll(async () => {
      const p = await createProduct(thirdProduct, jwtToken);
      thirdProdUuid = p.uuid;
      await Product.updateOne(
        { uuid: thirdProdUuid },
        { $set: { status: 'sold' } }
      );
    });

    it('should update the description, price, categoryIds and typeIds', async () => {
      product.description = 'amazing boots';
      product.price = '9.99';
      product.categoryIds = [3];
      product.typeIds = [3];
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send(product)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data.description).toBe(product.description);
          expect(res.body.data.price).toBe(product.price);
          expect(res.body.data.categoryIds).toEqual(product.categoryIds);
          expect(res.body.data.typeIds).toEqual(product.typeIds);
        });
    });

    it('should update the tags', async () => {
      product.tags = ['amazing', 'yolo'];
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send(product)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          expect(res.body.data.tags).toEqual(product.tags);
        });
    });

    it('should not update a product which is not mine', async () => {
      return request(app)
        .put(`/api/products/${anotherProdUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Unauthorized');
        });
    });

    it('should **not** update a product that has been sold', async () => {
      return request(app)
        .put(`/api/products/${thirdProdUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe(
            'Cannot update a product that has been sold'
          );
        });
    });
  });
});
