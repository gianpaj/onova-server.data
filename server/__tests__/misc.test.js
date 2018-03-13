// @flow

import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 1500;

describe('## Misc', () => {
  describe('# GET /api/health-check', () => {
    it('should return OK', async () => {
      return request(app)
        .get('/api/health-check')
        .expect(httpStatus.OK)
        .expect('Content-Type', /text\/html/)
        .then(res => {
          expect(res.text).toBe('OK');
        });
    });
  });

  describe('# GET /api/health-check/json', () => {
    it('should return OK', async () => {
      return request(app)
        .get('/api/health-check/json')
        .expect(httpStatus.OK)
        .expect('Content-Type', /json/)
        .then(res => {
          expect(res.body.ok).toBe(true);
        });
    });
  });

  describe('# GET /api/404', () => {
    it('should return 404 status', async () => {
      return request(app)
        .get('/api/404')
        .expect(httpStatus.NOT_FOUND)
        .then(res => {
          expect(res.body.message).toBe('Not Found');
        });
    });
  });

  describe('# Error Handling', () => {
    it('should handle Invalid user', async () => {
      return request(app)
        .get('/api/users/56z787zzz67fc')
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('Invalid user');
        });
    });

    it('should handle express validation error - username is required', async () => {
      return request(app)
        .post('/api/users')
        .send({
          emailAddress: 'blah@gmail.com',
          mobileNumber: '1234567890',
          password: 'iwanttogotomars',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).toBe('"username" is required');
        });
    });
  });
});
