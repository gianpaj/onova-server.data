// @flow

import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/drop.validation';
import dropCtrl from '../controllers/drop.controller';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

router
  .route('/')
  // GET /api/v2/drops - get a user's drops
  .get(validate(paramValidation.getDrops), dropCtrl.get)

  // POST /api/v2/drops - create a drop
  .post(validate(paramValidation.createDrop), requireAuth, dropCtrl.create);

export default router;
