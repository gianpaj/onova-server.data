import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/param-validation';
import authCtrl from '../controllers/auth.controller';
import config from '../config/config';

const requireAuth = passport.authenticate('jwt', { session: false });

const router = express.Router(); // eslint-disable-line new-cap

/**
 * POST /api/auth/login
 *
 * Returns token if correct username and password is provided */
router.route('/login')
  .post(validate(paramValidation.login), authCtrl.login);

/**
 * GET /api/auth/random-number - (Protected route)
 *
 * Needs token returned by the above route as header. Authorization: JWT {token} */
router.route('/random-number')
  .get(requireAuth, authCtrl.getRandomNumber);

/**
 * GET /api/auth/activate
 *
 * Activate user after clicking on email verification link
 */
router.route('/activate/:token')
  .get(validate(paramValidation.activate), authCtrl.activate)

export default router;
