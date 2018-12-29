// @flow

import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/drop.validation';
import dropCtrl from '../controllers/drop.controller';
import APIError from '../helpers/APIError';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

/**
 * Authorization Required middleware.
 */
function isAdmin(req, res, next) {
  if (!['alex', 'onova', 'gianpaj'].includes(req.user.username)) {
    const err = new APIError('Unauthorized', 401);
    return next(err);
  }
  next();
}

router
  .route('/:uuid')
  // GET /api/v2/drops/:uuid - get single drop
  .get(validate(paramValidation.getDrop), dropCtrl.get)

  // DELETE /api/v2/drops/:uuid - delete a drop (only Admins)
  .delete(
    validate(paramValidation.delete),
    requireAuth,
    isAdmin,
    dropCtrl.remove
  );

router
  .route('/')
  // GET /api/v2/drops - get a user's drops
  .get(validate(paramValidation.getDrops), dropCtrl.list)

  // POST /api/v2/drops - create a drop
  .post(validate(paramValidation.create), requireAuth, dropCtrl.create);

// Load a drop when API with uuid route parameter is hit
router.param('uuid', dropCtrl.load);

export default router;
