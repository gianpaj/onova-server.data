// @flow

import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';

describe('## Shipping', () => {
  describe('# GET /api/shipping/cities', () => {
    it('should get the list of cities', () => {
      return request(app)
        .get('/api/shipping/cities')
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data).toHaveLength(993));
    });

    // it('should handle Invalid user', () => {
    //   return request(app)
    //     .get('/api/users/56z787zzz67fc')
    //     .expect(httpStatus.BAD_REQUEST)
    //     .then(res => {
    //       expect(res.body.message).toBe('Invalid user');
    //     });
    // });
  });
});
