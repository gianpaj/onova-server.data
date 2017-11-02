import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/param-validation';
import userCtrl from '../controllers/user.controller';

const requireAuth = passport.authenticate('jwt', { session: false });

const router = express.Router(); // eslint-disable-line new-cap

router.route('/')
  /** GET /api/users - Get list of users */
  .get(userCtrl.list)

  /** POST /api/users - Create new user */
  .post(validate(paramValidation.createUser), userCtrl.create);

router.route('/:userId')
  /** GET /api/users/:userId - Get user */
  .get(userCtrl.get)

  /** PUT /api/users/:userId - Update user */
  .put(validate(paramValidation.updateUser), requireAuth, userCtrl.update)

  /** DELETE /api/users/:userId - Delete user - Protected route */
  .delete(requireAuth, userCtrl.remove);

/** Load user when API with userId route parameter is hit */
router.param('userId', userCtrl.load);

export default router;
