// @flow

import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/schedule.validation';
import scheduleCtrl from '../controllers/schedule.controller';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

router
  .route('/')
  // GET /api/schedule - Get list of scheduled listings
  .get(validate(paramValidation.listSchedule), requireAuth, scheduleCtrl.list)

  // POST /api/schedule - Schedule a listing
  .post(
    validate(paramValidation.createSchedule),
    requireAuth,
    scheduleCtrl.create
  );

export default router;
