// @flow

import request from 'supertest';
import httpStatus from 'http-status';
import path from 'path';

import app from '../index';

import { beforeAllTests, createUserAndLogin } from './utils';

let user = {
  username: 'userOne',
  emailAddress: 'userOne+test@gmail.com',
  password: 'userOneP4$$',
};

let jwtToken;

describe('## Photo Upload APIs', () => {
  beforeAll(beforeAllTests);

  // create 1 user
  beforeAll(() => {
    return createUserAndLogin(user).then(
      ({ user: resUser, jwtToken: token }) => {
        jwtToken = token;
      }
    );
  });

  describe('# POST /api/photos/upload-chat-images', () => {
    let pathImage1;
    it('should send an chat image a listing', () => {
      return request(app)
        .post('/api/photos/upload-chat-images')
        .set('Authorization', jwtToken)
        .attach('photo', path.join(__dirname, 'images/boots-large.jpg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          expect(body.data.originalname).toBe('boots-large.jpg');
          expect(body.data.fieldname).toBe('photo');
          expect(body.data.encoding).toBe('7bit');
          expect(body.data.mimetype).toBe('image/jpeg');
          expect(body.data['thumb.jpeg'].path).toContain(
            'storage.googleapis.com/chat-images.onova.co/'
          );
          expect(body.data['thumb.jpeg'].filename).toContain('thumb');
          expect(body.data['.jpeg'].path).toContain(
            'storage.googleapis.com/chat-images.onova.co/'
          );
          expect(body.data['.jpeg'].filename).toContain('-.jpeg');
          pathImage1 = body.data['.jpeg'].path;
        });
    });
  });
});
