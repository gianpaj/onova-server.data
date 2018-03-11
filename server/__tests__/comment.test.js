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
import { createProduct } from './product.test';
import { createUserAndLogin } from './user.test';

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

// should only have these fields
const commentFields = ['_id', 'createdAt', 'text', 'user'];

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
  pushToken:
    'e4Xu1jjTbXg:APA91bF_3S7FuBIDjO6feBMy1OzD2JsVtUJwVmIJD8YYPNk417zxX8YTYv_FoCCjg-x1rXUlHlxzKDjflXCK7Dujvff81aDBXFet8S8z99lK2_QwBIhvjQchS3HlTfJCuoJnfbm6xEjW',
  platform: 'ios',
};

let anotherUser = {
  username: 'anotherperson',
  emailAddress: 'gianpa+test2@gmail.com',
  mobileNumber: '1234567890', // optional
  password: 'express2',
  pushToken:
    'e4Xu1jjTbXg:APA91bF_3S7FuBIDjO6feBMy1OzD2JsVtUJwVmIJD8YYPNk417zxX8YTYv_FoCCjg-x1rXUlHlxzKDjflXCK7Dujvff81aDBXFet8S8z99lK2_QwBIhvjQchS3HlTfJCuoJnfbm6xEjW',
  platform: 'android',
};

const thirdUser = {
  username: 'thirdwheel',
  emailAddress: 'gianpa+thirdwheel@gmail.com',
  password: 'express3',
};

const notForSaleProduct = {
  categoryIds: [2],
  typeIds: [1, 3],
  tags: ['WINTER'],
  description: 'nice scarf',
  price: '30',
};

let productUuid;
let anotherProductUuid;
let notForSaleProductUuid;
let jwtToken;
let anotherJwtToken;
let thirdJWTtoken;

describe('## Comment APIs', () => {
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
    createUserAndLogin(user)
      .then(({ user, jwtToken: token }) => {
        // userId = user._id;
        jwtToken = token;
      })
      .then(() => {
        return request(app)
          .post('/api/users')
          .send(thirdUser)
          .expect(httpStatus.CREATED)
          .then(res => {
            const resUser = res.body.data;
            expect(resUser.username).toBe(thirdUser.username);
            expect(resUser.emailAddress).toBe(thirdUser.emailAddress);
            expect(resUser.accountStatus).toBe('notverified');
          });
      })
      .then(() => {
        return request(app)
          .post('/api/auth/login')
          .send({
            emailAddress: thirdUser.emailAddress,
            password: thirdUser.password,
          })
          .expect(httpStatus.OK)
          .then(res => {
            thirdJWTtoken = res.body.token;
          });
      })
      .then(() => {
        return Tag.create([{ _id: 'winter' }, { _id: 'summer' }]).then();
      })
      .then(async () => {
        return createUserAndLogin(anotherUser).then(
          ({ user, jwtToken: token }) => {
            // anotherUserId = user._id;
            anotherJwtToken = token;
          }
        );
      })
      .then(async () => {
        const p1 = await createProduct(product, jwtToken);
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
        notForSaleProductUuid = p3.uuid;
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

  describe('# POST /api/products/:uuid/comment', () => {
    beforeAll(done => {
      Product.collection.update({}, { $unset: { comments: '' } }, () => {
        done();
      });
    });

    it('should add a comment to a product', async () => {
      return request(app)
        .post(`/api/products/${productUuid}/comment`)
        .set('Authorization', anotherJwtToken)
        .send({ text: 'first!' })
        .expect(httpStatus.CREATED)
        .then(res => {
          const { data } = res.body;
          expect(data.uuid).toBe(productUuid);
          expect(Object.keys(data.comment).sort()).toEqual(
            commentFields.sort()
          );
        });
    });

    it('should not add a comment to a deleted product', async () => {
      return request(app)
        .post(`/api/products/${notForSaleProductUuid}/comment`)
        .set('Authorization', anotherJwtToken)
        .send({ text: 'first!' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('Comment cannot be added');
        });
    });

    it('should not add a comment without a verified account', async () => {
      return request(app)
        .post(`/api/products/${productUuid}/comment`)
        .set('Authorization', thirdJWTtoken)
        .send({ text: 'first!' })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('Please verify your account befo');
        });
    });
  });

  describe('# GET /api/products/:uuid/comment', () => {
    let commentIdFirst;

    beforeAll(done => {
      Product.collection.update({}, { $unset: { comments: '' } }, () => {
        done();
      });
    });

    beforeAll(async () => {
      const data = await createComment('nice jacket', productUuid, jwtToken);
      commentIdFirst = data.comment._id;
    });

    it('should get the first product`s comments', async () => {
      return request(app)
        .get(`/api/products/${productUuid}/comment`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data.uuid).toBe(productUuid);
          expect(data.comments[0]._id).toBe(commentIdFirst);
          expect(Object.keys(data.comments[0]).sort()).toEqual(
            commentFields.sort()
          );
          expect(data.comments).toHaveLength(1);
        });
    });

    it('should not get comments if i am not authenticated', async () => {
      return request(app)
        .get(`/api/products/${productUuid}/comment`)
        .expect(httpStatus.UNAUTHORIZED)
        .then();
    });
  });

  describe('# DELETE /api/products/:uuid/comment/:commentId', () => {
    let commentIdSecond;

    beforeAll(done => {
      Product.collection.update({}, { $unset: { comments: '' } }, () => {
        done();
      });
    });

    beforeAll(async () => {
      const data = await createComment('nice jacket', productUuid, jwtToken);
      commentIdSecond = data.comment._id;
    });

    it('should delete the first product`s comments', async () => {
      return request(app)
        .delete(`/api/products/${productUuid}/comment/${commentIdSecond}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data.uuid).toBe(productUuid);
          expect(data.length).toBe(0);
        });
    });

    it('should not delete a comment that doesn`t exist', async () => {
      return request(app)
        .delete(`/api/products/${productUuid}/comment/${commentIdSecond}`)
        .set('Authorization', jwtToken)
        .expect(httpStatus.NOT_FOUND)
        .then(res => {
          expect(res.body.message).toContain('Comment not found');
        });
    });

    // it('should not get comments if i am not authenticated', async () => {
    //   return request(app)
    //     .get(`/api/products/${productUuid}/comment`)
    //     .expect(httpStatus.UNAUTHORIZED)
    //     .then();
    // });
  });

  // describe('# GET /api/products/:uuid/comment?lastId=', () => {
  //   // delete all Products
  //   beforeAll(done => {
  //     const collections = [Product.collection];
  //     var todo = collections.length;
  //     if (!todo) return done();

  //     collections.forEach(collection => {
  //       collection.remove({}, { safe: true }, () => {
  //         if (--todo === 0) done();
  //       });
  //     });
  //   });

  //   beforeAll(async () => {
  //     const a = await createManyProducts(105, jwtToken);
  //     if (typeof a == Error) console.error(a);
  //   });

  //   let lastId;

  //   it('should get feed with pagination', async () => {
  //     return request(app)
  //       .get('/api/feed/flat')
  //       .set('Authorization', anotherJwtToken)
  //       .expect(httpStatus.OK)
  //       .then(res => {
  //         const { data } = res.body;
  //         expect(data).toHaveLength(50);
  //         lastId = data[49]._id;
  //       });
  //   });

  //   it('should get feed with load more', async () => {
  //     return request(app)
  //       .get(`/api/feed/flat?lastId=${lastId}`)
  //       .set('Authorization', anotherJwtToken)
  //       .expect(httpStatus.OK)
  //       .then(res => {
  //         const { data } = res.body;
  //         expect(data[0]._id).not.toBe(lastId);
  //         expect(data).toHaveLength(50);
  //       });
  //   });
  // });
});

async function createManyComments(
  num: number,
  uuid: string,
  userId: string,
  jwtToken: string
) {
  const c = 'nice pair of socks';

  const Promises = [];
  for (let i = 0; i <= num; i++) {
    Promises.push(createComment(c, uuid, jwtToken));
  }
  return Promise.all(Promises)
    .then(res => res)
    .catch(e => e);
}

async function createComment(
  comment: string,
  uuid: string,
  jwtToken: string
): Promise<any> {
  return request(app)
    .post(`/api/products/${uuid}/comment`)
    .set('Authorization', jwtToken)
    .send({ text: comment })
    .expect(httpStatus.CREATED)
    .then(res => {
      const { data } = res.body;
      expect(data.uuid).toBe(uuid);
      return data;
    });
}
