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

  describe('# POST /api/photos/upload', () => {
    it('should upload a product image when scheduling', () => {
      return request(app)
        .post('/api/photos/upload')
        .set('Authorization', jwtToken)
        .attach('photo', path.join(__dirname, 'images/boots-large.jpg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const { data } = body;
          expect(data.fieldname).toBe('photo');
          expect(data.originalname).toBe('boots-large.jpg');
          expect(data.encoding).toBe('7bit');
          expect(data.mimetype).toBe('image/jpeg');
          expect(data['thumb.jpeg'].path).toContain(
            'storage.googleapis.com/temp-uploads.onova.co/'
          );
          expect(data['thumb.jpeg'].filename).toContain('thumb');
          expect(data['.jpeg'].path).toContain(
            'storage.googleapis.com/temp-uploads.onova.co/'
          );
          expect(data['.jpeg'].filename).toContain('-.jpeg');
          expect(Object.keys(data).sort()).toEqual([
            '.jpeg',
            'encoding',
            'fieldname',
            'mimetype',
            'originalname',
            'thumb.jpeg',
          ]);
        });
    });
  });

  describe('# POST /api/photos/upload-chat-images', () => {
    // let pathImage1;
    it('should upload a chat image', () => {
      return request(app)
        .post('/api/photos/upload-chat-images')
        .set('Authorization', jwtToken)
        .attach('photo', path.join(__dirname, 'images/boots-large.jpg'))
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const { data } = body;
          expect(data.originalname).toBe('boots-large.jpg');
          expect(data.fieldname).toBe('photo');
          expect(data.encoding).toBe('7bit');
          expect(data.mimetype).toBe('image/jpeg');
          expect(data['thumb.jpeg'].path).toContain(
            'storage.googleapis.com/chat-images.onova.co/'
          );
          expect(data['thumb.jpeg'].filename).toContain('thumb');
          expect(data['.jpeg'].path).toContain(
            'storage.googleapis.com/chat-images.onova.co/'
          );
          expect(data['.jpeg'].filename).toContain('-.jpeg');
          // pathImage1 = data['.jpeg'].path;
          expect(Object.keys(data).sort()).toEqual([
            '.jpeg',
            'encoding',
            'fieldname',
            'mimetype',
            'originalname',
            'thumb.jpeg',
          ]);
        });
    });
  });

  describe('# POST /api/photos/upload-to-vk', () => {
    it('should upload multiple product image when scheduling a post to VK', () => {
      return request(app)
        .post('/api/photos/upload-to-vk')
        .send({
          photos: [
            'https://storage.googleapis.com/temp-uploads.onova.co/1530020978946-.jpeg',
            'https://storage.googleapis.com/temp-uploads.onova.co/1530020977744-.jpeg',
          ],
          upload_url:
            'https://pu.vk.com/c849424/upload.php?act=do_add&mid=184591202&aid=-14&gid=0&hash=0b70b5d3a85c5dd69e2923283318effd&rhash=2b42cb02fe37c08e68412e788aa1d88e&swfupload=1&api=1&wallphoto=1',
        })
        .set('Authorization', jwtToken)
        .expect(httpStatus.CREATED)
        .then(({ body }) => {
          const { data } = body;
          expect(data.length).toBe(2);
          expect(typeof data[0].photo).toBe('string');
          expect(data[0].photo.length).toBeGreaterThan(5);
          expect(Object.keys(data[0]).sort()).toEqual([
            'hash',
            'photo',
            'server',
          ]);
        });
    });
  });
});
