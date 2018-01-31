import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/auth.validation';
import authCtrl from '../controllers/auth.controller';

const requireAuth = passport.authenticate('jwt', { session: false });

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Returns token if correct username and password is provided
 */
router.route('/login').post(validate(paramValidation.login), authCtrl.login);

/**
 * GET /api/auth/random-number - (Protected route)
 *
 * Needs token returned by the above route as header. Authorization: JWT {token}
 */
router.route('/random-number').get(requireAuth, authCtrl.getRandomNumber);

/**
 * GET /api/auth/activate/:token
 *
 * Activate user after clicking on email verification link
 */
router
  .route('/activate/:token')
  .get(validate(paramValidation.activate), authCtrl.activate);

/**
 * POST /api/auth/reset
 *
 * Request password reset by email
 */
router
  .route('/reset')
  .post(validate(paramValidation.requestReset), authCtrl.requestPassReset);

router
  .route('/reset/:token')
  /** GET /api/auth/reset/:token - Render page to change password */
  .get(authCtrl.resetPage)

  /** POST /api/auth/reset/:token - Change user password */
  .post(validate(paramValidation.resetForm), authCtrl.resetFormSubmit);

export default router;
