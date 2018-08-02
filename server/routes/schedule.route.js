// @flow

import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/schedule.validation';
import scheduleCtrl from '../controllers/schedule.controller';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

/**
 * Only check authentication and load user as `req.user` object if the header is sent.
 * This is use to get the products except the ones user's blocking
 */
// function conditionalAuth(req, res, next) {
//   if (req.get('Authorization')) {
//     return requireAuth(req, res, next);
//   }
//   next();
// }

// POST /api/schedule - Schedule a listing
router
  .route('/')
  .post(
    validate(paramValidation.createSchedule),
    requireAuth,
    scheduleCtrl.create
  );

export default router;
