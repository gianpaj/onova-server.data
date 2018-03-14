// @flow

import mongoose from 'mongoose';
import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';
import Follow from '../models/follow.model';
import User from '../models/user.model';
import Verification from '../models/verification.model';
import { createUserAndLogin } from './utils';

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

describe('## Follow APIs', () => {
  beforeAll(done => {
    const collections = [
      Follow.collection,
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

  let userId;
  let anotherUserId;
  let thirdUserId;
  let firstJwtToken;
  let anotherJwtToken;

  // create 2 users/sellers
  beforeAll(async () => {
    await createUserAndLogin(user).then(({ user, jwtToken }) => {
      userId = user._id;
      firstJwtToken = jwtToken;
    });
    await createUserAndLogin(anotherUser).then(({ user, jwtToken }) => {
      anotherUserId = user._id;
      anotherJwtToken = jwtToken;
    });
    return await createUserAndLogin(thirdUser).then(({ user, jwtToken }) => {
      thirdUserId = user._id;
      // anotherJwtToken = jwtToken;
    });
  });

  describe('# POST /api/users/:userId/follow', () => {
    it('should follow another user', async () => {
      return request(app)
        .post(`/api/users/${anotherUserId}/follow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.CREATED)
        .then(res => {
          const { data } = res.body;
          expect(data.follower).toBe(userId);
          expect(data.following).toBe(anotherUserId);
          expect(Object.keys(data).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
        });
    });

    it('should not follow the same user more than once', async () => {
      return request(app)
        .post(`/api/users/${anotherUserId}/follow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('Duplicate follower<->following');
        });
    });

    describe('check followers/following counters', () => {
      beforeAll(async () => {
        return request(app)
          .post(`/api/users/${thirdUserId}/follow`)
          .set('Authorization', firstJwtToken)
          .expect(httpStatus.CREATED)
          .then(res => {
            expect(res.body.data.follower).toBe(userId);
          });
      });

      it('should increase the followers count of the target user', async () => {
        return request(app)
          .get(`/api/users/${userId}`)
          .expect(httpStatus.OK)
          .then(res => {
            expect(res.body.username).toBe(user.username);
            expect(res.body.emailAddress).toBe(user.emailAddress);
            expect(res.body.followersCount).toBe(0);
            expect(res.body.followingCount).toBe(2);
          });
      });

      it('should increase the followers count of the subject user', async () => {
        return request(app)
          .get(`/api/users/${thirdUserId}`)
          .expect(httpStatus.OK)
          .then(res => {
            expect(res.body.username).toBe(thirdUser.username);
            expect(res.body.emailAddress).toBe(thirdUser.emailAddress);
            expect(res.body.followersCount).toBe(1);
            expect(res.body.followingCount).toBe(0);
          });
      });
    });

    it('should not follow an invalid user', async () => {
      return request(app)
        .post('/api/users/1123123/follow')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('must be 24 characters long');
        });
    });

    it('should not follow a user it doesn`t exist', async () => {
      return request(app)
        .post('/api/users/5aaaac09336c6735ff0346f9/follow')
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Error following a user');
        });
    });

    it('should not follow itself', async () => {
      return request(app)
        .post(`/api/users/${anotherUserId}/follow`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Cannot follow thyself');
        });
    });

    it('should follow back', async () => {
      return request(app)
        .post(`/api/users/${userId}/follow`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.CREATED)
        .then(res => {
          const { data } = res.body;
          expect(data.follower).toBe(anotherUserId);
          expect(data.following).toBe(userId);
          expect(data).toHaveProperty('dateCreated');
        });
    });
  });

  describe('# POST /api/users/:userId/unfollow', () => {
    it('should unfollow another user', async () => {
      return request(app)
        .post(`/api/users/${anotherUserId}/unfollow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data.follower).toBe(userId);
          expect(data.following).toBe(anotherUserId);
          expect(Object.keys(data).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
        });
    });

    it('should not unfollow an invalid user', async () => {
      return request(app)
        .post('/api/users/2123412d/unfollow')
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('must be 24 characters long');
        });
    });

    it('should not unfollow a user that doesn`t exist', async () => {
      return request(app)
        .post('/api/users/5aaaac09336c6735ff0346f9/unfollow')
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Error unfollowing a user');
        });
    });

    it('should not unfollow itself', async () => {
      return request(app)
        .post(`/api/users/${anotherUserId}/unfollow`)
        .set('Authorization', anotherJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Cannot unfollow thyself');
        });
    });
  });

  describe('# GET /api/users/:userId/followers', () => {
    it('should get all followers', async () => {
      return request(app)
        .get(`/api/users/${userId}/followers`)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBe(1);
          // expect(data[0].following).toBe(userId);
          expect(typeof data[0].follower).toBe('object');
          expect(Object.keys(data[0]).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
        });
    });
  });

  describe('# GET /api/users/:userId/following', () => {
    it('should get all following', async () => {
      return request(app)
        .get(`/api/users/${userId}/following`)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBe(1);
          // expect(data[0].follower).toBe(userId);
          expect(typeof data[0].following).toBe('object');
          expect(Object.keys(data[0]).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
        });
    });
  });

  describe('# GET /api/users/:userId/follow', () => {
    beforeAll(async () => {
      return request(app)
        .post(`/api/users/${anotherUserId}/follow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.CREATED)
        .then(res => {
          const { data } = res.body;
          expect(data.follower).toBe(userId);
          expect(data.following).toBe(anotherUserId);
          expect(Object.keys(data).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
        });
    });

    it('should get that i am following a user', async () => {
      return request(app)
        .get(`/api/users/${anotherUserId}/follow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.OK)
        .then(res => {
          const { data } = res.body;
          expect(data.follower).toBe(userId);
          expect(data.following).toBe(anotherUserId);
          expect(Object.keys(data).sort()).toEqual(
            ['follower', 'following', 'dateCreated'].sort()
          );
        });
    });

    it('should get that i am not following a user', async () => {
      return request(app)
        .get(`/api/users/5aaaac09336c6735ff0346f9/follow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.NOT_FOUND)
        .then(res => {
          expect(res.body.message).toContain('Not following');
        });
    });

    it('should not able to check if your`re following yourself', async () => {
      return request(app)
        .get(`/api/users/${userId}/follow`)
        .set('Authorization', firstJwtToken)
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toContain('Cannot follow thyself');
        });
    });
  });
});
