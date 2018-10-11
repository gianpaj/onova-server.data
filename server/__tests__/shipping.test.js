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
        .then(({ body }) => expect(body.data).toHaveLength(838));
    });
  });

  describe('# GET /api/shipping/departments/${city}', () => {
    it('should get the list of departments', () => {
      const kiev = '8d5a980d-391c-11dd-90d9-001a92567626';
      return request(app)
        .get(`/api/shipping/departments/${kiev}`)
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.data).toHaveLength(280));
    });

    it('should NOT get the list of departments for an invalid city', () => {
      return request(app)
        .get(`/api/shipping/departments/8d5a980d-391c-11dd-90d9-001a92567699`)
        .expect(httpStatus.SERVICE_UNAVAILABLE)
        .then(res =>
          expect(res.body.message).toContain(
            'Error getting list of departments'
          )
        );
    });
  });
});
