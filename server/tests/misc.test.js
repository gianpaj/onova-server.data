import request from 'supertest';
import httpStatus from 'http-status';
import chai, { expect } from 'chai';

import app from '../index';

chai.config.includeStack = true;

// clear screen
process.stdout.write('\x1Bc');

describe('## Misc', () => {
  describe('# GET /api/health-check', () => {
    it('should return OK', done => {
      request(app)
        .get('/api/health-check')
        .expect(httpStatus.OK)
        .expect('Content-Type', /text\/html/)
        .then(res => {
          expect(res.text).to.equal('OK');
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/health-check/json', () => {
    it('should return OK', done => {
      request(app)
        .get('/api/health-check/json')
        .expect(httpStatus.OK)
        .expect('Content-Type', /json/)
        .then(res => {
          expect(res.body.ok).to.equal(true);
          done();
        })
        .catch(done);
    });
  });

  describe('# GET /api/404', () => {
    it('should return 404 status', done => {
      request(app)
        .get('/api/404')
        .expect(httpStatus.NOT_FOUND)
        .then(res => {
          expect(res.body.message).to.equal('Not Found');
          done();
        })
        .catch(done);
    });
  });

  describe('# Error Handling', () => {
    it('should handle Invalid user', done => {
      request(app)
        .get('/api/users/56z787zzz67fc')
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).to.equal('Invalid user');
          done();
        })
        .catch(done);
    });

    it('should handle express validation error - username is required', done => {
      request(app)
        .post('/api/users')
        .send({
          emailAddress: 'blah@gmail.com',
          mobileNumber: '1234567890',
          password: 'iwanttogotomars',
        })
        .expect(httpStatus.BAD_REQUEST)
        .then(res => {
          expect(res.body.message).to.equal('"username" is required');
          done();
        })
        .catch(done);
    });
  });
});
