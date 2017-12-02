import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';

import Verification from '../models/verification.model';
import User from '../models/user.model';
import Tag from '../models/tag.model';
import Product from '../models/product.model';

// jest.mock('@google-cloud/storage');

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
    const collections = [Product.collection, Tag.collection, User.collection];

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
  let anotherProductUuid;

  beforeAll(done => {
    // create 2 users/sellers
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
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
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
            anotherUser._id = res.body.data._id;
          })
          .then(() => {
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

  describe('# POST /api/products', () => {
    it('should create product', async () => {
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
          expect(p.photoURIs).toEqual(['UPLOADING_PIC', 'UPLOADING_PIC']);
          expect(p.price).toBe(product.price);
          expect(p.seller).toBe(user._id);
          expect(p.status).toBe('forsale');
          expect(Array.isArray(p.tags));
          expect(p.tags).toEqual(product.tags);
          expect(p.typeIds.sort()).toEqual([1, 2, 3]);
          expect(Object.keys(p).sort()).toEqual(productFields.sort());
          productUuid = p.uuid;
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

    it('should not create product with an invalid tag', async () => {
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

    it('should not create product with another invalid tag', async () => {
      badProduct.tags = ['my pony'];
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
  });

  describe('# GET /api/products/:uuid', () => {
    it('should get an existing product', async () => {
      return request(app)
        .get(`/api/products/${productUuid}`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(p.description).toBe(product.description);
          expect(p.seller._id).toBe(user._id);
          expect(p.seller.username).toBe(user.username);
          expect(p.status).toBe('forsale');
          expect(p.currency).toBe('UAH');
          expect(Array.isArray(p.likes));
          expect(p.likes).toHaveLength(0);
          expect(Array.isArray(p.comments));
          expect(p.comments).toHaveLength(0);
          expect(Array.isArray(p.tags));
          expect(p.tags).toHaveLength(2);
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
      request(app)
        .post('/api/products')
        .set('Authorization', jwtToken)
        .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
        .field(anotherProduct)
        .expect(httpStatus.CREATED)
        .then(res => {
          expect(typeof res.body.data).toBe('object');
        })
        .then(() => {
          request(app)
            .post('/api/products')
            .set('Authorization', jwtToken)
            .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
            .field(thirdProduct)
            .expect(httpStatus.CREATED)
            .then(res => {
              expect(res.body.data.tags).toEqual(
                expect.arrayContaining(thirdProduct.tags)
              );
              expect(res.body.data.tags).toHaveLength(1);
              expect(typeof res.body.data).toBe('object');
              done();
            });
        });
    });

    it('should get all products', async () => {
      return request(app)
        .get(`/api/products/`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p.length).toBe(3);
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
          expect(p[0].description).toBe(thirdProduct.description);
        });
    });

    it('should get only the first product', async () => {
      return request(app)
        .get(`/api/products/?limit=1&skip=2`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p.length).toBe(1);
          expect(p[0].description).toBe(product.description);
        });
    });
  });

  describe('# GET /api/products/?tags=', () => {
    it('should find all winter products', async () => {
      return request(app)
        .get(`/api/products/?tags=winter`)
        .expect(httpStatus.OK)
        .then(res => {
          const p = res.body.data;
          expect(Array.isArray(p));
          expect(p.length).toBe(1);
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
        });
    });

    it('should get all remaining products', async () => {
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

    it('should not delete a deleted product', async () => {
      return request(app)
        .delete(`/api/products/${productUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body).toMatchObject({});
        });
    });

    describe('deleting another product', () => {
      beforeAll(done => {
        request(app)
          .post('/api/products')
          .set('Authorization', anotherJwtToken)
          .attach('photos', path.join(__dirname, 'images/boots1.jpg'))
          .field(anotherProduct)
          .expect(httpStatus.CREATED)
          .then(res => {
            anotherProductUuid = res.body.data.uuid;
            expect(typeof res.body.data).toBe('object');
            done();
          });
      });

      it('should not delete a product which is not mine', async () => {
        return request(app)
          .delete(`/api/products/${anotherProductUuid}`)
          .set('Authorization', jwtToken)
          .expect(httpStatus.UNAUTHORIZED)
          .then(res => {
            expect(res.body.message).toBe('Unauthorized');
          });
      });
    });
  });

  describe('# UPDATE /api/products/:uuid', () => {
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
        .put(`/api/products/${anotherProductUuid}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.UNAUTHORIZED)
        .then(res => {
          expect(res.body.message).toBe('Unauthorized');
        });
    });
  });
});
