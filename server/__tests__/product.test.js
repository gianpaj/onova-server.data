// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';

import Tag from '../models/tag.model';
import Product from '../models/product.model';
import {
  beforeAllTests,
  createProduct,
  createUserAndLogin,
  productFields,
} from './utils';

// jest.mock('@google-cloud/storage');

describe('## Product APIs', () => {
  beforeAll(beforeAllTests);

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
    price: '100.99', // if 1 decimal point .00 will be added
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
    tags: ['spring'],
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
  let prodUuidWithLocality;

  let productsCounter = 0;

  // create 2 users/sellers + Tag and upload profile pic of a seller
  beforeAll(done => {
    createUserAndLogin(user)
      .then(({ user: resUser, jwtToken: token }) => {
        user._id = resUser._id;
        jwtToken = token;
      })
      .then(() => {
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
    it('should create a product without coordinates', () => {
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
          expect(p.photoURIs).toEqual([
            'http://assets.onova.co/products/B11zDErJQ-1-1527232263107.jpg',
          ]);
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

    it('should create a product with coordinates', async () => {
      const p = await createProduct(
        { ...anotherProduct, longitude: 23.9573617, latitude: 49.8134431 },
        jwtToken
      );
      expect(p.locality).toBe('Lviv');
      expect(p.description).toBe(anotherProduct.description);
      expect(Object.keys(p).sort()).toEqual(
        [...productFields, 'comments', 'locality'].sort()
      );
      prodUuidWithLocality = p.uuid;
      productsCounter++;
    });

    // it('should NOT create a product with invalid coordinates', () => {
    //   return request(app)
    //     .post('/api/products')
    //     .set('Authorization', jwtToken)
    //     .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
    //     .field({
    //       ...anotherProduct,
    //       longitude: 0.1,
    //       latitude: 0.1,
    //     })
    //     .expect(httpStatus.BAD_REQUEST)
    //     .then(res => {
    //       const p = res.body.data;
    //       // console.log(p);
    //     });
    // });

    it('should not create product with wrong file uploaded', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .attach('photos', path.join(__dirname, 'misc.test.js'))
        .field(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain(
            'File upload only supports the following filetypes'
          )
        );
    });

    it('should not create product without uploading a photo', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field(product)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toBe('Product image(s) are required')
        );
    });

    it('should not create product with an invalid tag (with @)', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field(badProduct)
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('fails to match the required pattern')
        );
    });

    it('should not create product with an invalid tag (with space)', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...badProduct, tags: ['my pony'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('fails to match the required pattern')
        );
    });

    it('should not create product with an invalid tag (with .)', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...badProduct, tags: ['lol.pony'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('fails to match the required pattern')
        );
    });

    it('should create product with a valid tag (start with numbers)', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...product, tags: ['111pony'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.CREATED)
        .then(() => void productsCounter++);
    });

    it('should create product with a valid price (once decimal point)', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...product, price: '111.1' })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data.price).toBe('111.10');
          productsCounter++;
        });
    });

    it('should create product with a valid tag (cyrilic)', () => {
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field({ ...product, tags: ['плнаше'] })
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.CREATED)
        .then(() => void productsCounter++);
    });

    it('should not create product without a proper price', () => {
      badProduct.tags = ['winter'];
      badProduct.price = '0';
      return request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .field(badProduct)
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toContain('"price" contains an invalid value')
        );
    });
  });

  describe('# GET /api/products/:uuid', () => {
    it('should get an existing product', () => {
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
            ['_id', 'accountStatus', 'profilePic', 'username'].sort()
          );
          expect(p.seller.profilePic).toContain(
            'http://assets.onova.co/users/5b091babdde06965f6580a6b-1527323596437.jpg'
          );
          expect(p.seller.profilePic).toContain('.jpg');
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
          expect(p.photoURIs).toHaveLength(1);
        });
    });

    it('should not get an non valid product', () => {
      return request(app)
        .get('/api/products/SkveMe9lz')
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toBe('Invalid product'));
    });

    it('should get a product with locality', () => {
      return request(app)
        .get(`/api/products/${prodUuidWithLocality}`)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(Object.keys(body.data).sort()).toEqual(
            [...productFields, 'locality'].sort()
          );
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

    it('should get all products', () => {
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

    it('should get only the last product', () => {
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

    it("should get only the user's products by userid", () => {
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

    it("should get only the user's products by username", () => {
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

    it("should not get only user's products by non existant username", () => {
      return request(app)
        .get(`/api/products/?username=banana`)
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('# GET /api/products/?tags=', () => {
    it('should find products by a single tag', () => {
      return request(app)
        .get('/api/products/?tags=winter')
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p).toHaveLength(2);
          expect(p[0].description).toBe(product.description);
        });
    });

    it('should find products by multiple tags', () => {
      return request(app)
        .get('/api/products/?tags[]=winter&tags[]=spring')
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(Array.isArray(body.data));
          expect(body.data).toHaveLength(3);
          expect(body.data[0].tags).toEqual(thirdProduct.tags);
          expect(body.data[1].tags).toEqual(product.tags);
          // not duplicated product. just the same product was added twice
          expect(body.data[2].tags).toEqual(product.tags);
        });
    });
  });

  describe('# DELETE /api/products/:uuid', () => {
    it('should delete an existing product', () => {
      return request(app)
        .delete(`/api/products/${productUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.NO_CONTENT)
        .then(({ body }) => {
          expect(body).toMatchObject({});
          productsCounter--;
        });
    });

    it('should get all remaining products', () => {
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

    it('should not delete a deleted product', () => {
      return request(app)
        .delete(`/api/products/${productUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body).toMatchObject({}));
    });

    describe('create another product', () => {
      beforeAll(async () => {
        const p = await createProduct(anotherProduct, anotherJwtToken);
        anotherProdUuid = p.uuid;
      });

      it('should not delete a product which is not mine', () => {
        return request(app)
          .delete(`/api/products/${anotherProdUuid}`)
          .set('Authorization', jwtToken)
          .expect(httpStatus.UNAUTHORIZED)
          .then(({ body }) => expect(body.message).toBe('Unauthorized'));
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

    it('should update the description, price, categoryIds and typeIds', () => {
      product.description = 'amazing boots';
      product.price = '9.99';
      product.categoryIds = [3];
      product.typeIds = [3];
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send(product)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(body.data.description).toBe(product.description);
          expect(body.data.price).toBe(product.price);
          expect(body.data.categoryIds).toEqual(product.categoryIds);
          expect(body.data.typeIds).toEqual(product.typeIds);
        });
    });

    it('should update the tags', () => {
      product.tags = ['amazing', 'yolo'];
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send(product)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data.tags).toEqual(product.tags));
    });

    it('should update the price', () => {
      product.price = '199.9';
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send(product)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data.price).toEqual('199.90'));
    });

    it('should update the price', () => {
      product.price = '199';
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send(product)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data.price).toEqual('199'));
    });

    it('should update the price', () => {
      product.price = '199.55';
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send(product)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data.price).toEqual('199.55'));
    });

    it('should update the images to GCS', () => {
      return request(app)
        .put(`/api/products/${productUuid}`)
        .field(product)
        .attach('photos', path.join(__dirname, 'images/boots2.jpg'))
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data.tags).toEqual(product.tags));
    });

    it('should **not** update with invalid field', () => {
      return request(app)
        .put(`/api/products/${productUuid}`)
        .send({ blah: 'dasdf' })
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) => expect(body.message).toBe('"blah" is not allowed'));
    });

    it('should not update a product which is not mine', () => {
      return request(app)
        .put(`/api/products/${anotherProdUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(({ body }) => expect(body.message).toBe('Unauthorized'));
    });

    it('should **not** update a product that has been sold', () => {
      return request(app)
        .put(`/api/products/${thirdProdUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(({ body }) =>
          expect(body.message).toBe(
            'Cannot update a product that has been sold'
          )
        );
    });
  });
});
