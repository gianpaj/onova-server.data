// @flow

import request from 'supertest';
import httpStatus from 'http-status';

import app from '../index';

const kiev = '8d5a980d-391c-11dd-90d9-001a92567626';

describe('## Shipping', () => {
  describe('# GET /api/shipping/cities', () => {
    it('should get the list of cities', () => {
      return request(app)
        .get('/api/shipping/cities')
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(Object.keys(body.data[0]).sort()).toMatchSnapshot();
          expect(body.data).toHaveLength(838);
        });
    });
  });

  describe('# GET /api/shipping/departments/${city}', () => {
    it('should get the list of departments', () => {
      return request(app)
        .get(`/api/shipping/departments/${kiev}`)
        .expect(httpStatus.OK)
        .then(({ body }) => {
          expect(Object.keys(body.data[0]).sort()).toMatchSnapshot();
          expect(body.data).toHaveLength(280);
        });
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

  describe('# GET /api/shipping/costs', () => {
    // Відділення № 376 (до 30 кг), Поштомат \"Приватбанк\": вул. Пимоненка, 13
    const senderOfficeID = 'ee1ca520-1bfd-11e5-add9-005056887b8d';
    // Відділення №1: вул. Червонопрапорна, 34 (Корчувате)
    const recipientOfficeID = '1ec09d88-e1c2-11e3-8c4a-0050568002cf';

    it('should NOT get the shipping costs without recipientOfficeID', () => {
      const product = {
        price: '100.99',
        weight: 300,
      };
      return request(app)
        .get(
          `/api/shipping/costs?price=${product.price}&weight=${
            product.weight
          }&senderOfficeID=${senderOfficeID}`
        )
        .expect(httpStatus.BAD_REQUEST)
        .then(res =>
          expect(res.body.message).toContain('"recipientOfficeID" is required')
        );
    });

    it('should get the shipping costs', () => {
      const product = {
        price: '100.99',
        weight: 300,
      };

      return request(app)
        .get(
          `/api/shipping/costs?price=${product.price}&weight=${
            product.weight
          }&senderOfficeID=${senderOfficeID}&recipientOfficeID=${recipientOfficeID}`
        )
        .expect(httpStatus.OK)
        .then(({ body }) => {
          // expect(typeof body.data).toBe('number');
          expect(body.data).toBe(2500);
        });
    });
  });
});
