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

  // POST /api/drop - create adrop
  .post(validate(paramValidation.createDrop), requireAuth, dropCtrl.create);

export default router;
