// @flow
import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/search.validation';
import searchCtrl from '../controllers/search.controller';

// loads Authenticated user document in `req.user`
const requireAuth = passport.authenticate('jwt', { session: false });

const router = express.Router();

router
  .route('/')

  // GET /api/search
  .get(validate(paramValidation.search), requireAuth, searchCtrl.get);

export default router;
