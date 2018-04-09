import express from 'express';
import validate from 'express-validation';
import passport from 'passport';
import APIError from '../helpers/APIError';

import paramValidation from '../config/validation/user.validation';
import notificationCtrl from '../controllers/notification.controller';
import userCtrl from '../controllers/user.controller';
import photos from '../helpers/photos';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

/**
 * Authorization Required middleware.
 */
function isAuthorized(req, res, next) {
  if (req.user._id.toString() !== req.params.userId) {
    const err = new APIError('Unauthorized', 401);
    return next(err);
  }
  next();
}

router
  .route('/notifications')

  // GET /api/users/notifications - Get user's notifications
  .get(validate(paramValidation.notif), requireAuth, notificationCtrl.get);

router
  .route('/')
  // GET /api/users/[?u=<username>] - Get list of users
  .get(validate(paramValidation.listUsers), userCtrl.list)

  // POST /api/users - Create new user
  .post(validate(paramValidation.createUser), userCtrl.create);

router
  .route('/:userId')
  // GET /api/users/:userId - Get user
  .get(userCtrl.get)

  // PUT /api/users/:userId - Update user - Protected route
  .put(
    photos.uploadMulter.single('profilePic'),
    validate(paramValidation.updateUser),
    requireAuth,
    isAuthorized,
    userCtrl.update
  )

  // DELETE /api/users/:userId - Delete user - Protected route
  .delete(requireAuth, isAuthorized, userCtrl.remove);

router
  .route('/:userId/personal')

  // GET /api/users/:userId/personal - Get user's personal info - Protected route
  .get(requireAuth, isAuthorized, userCtrl.getPersonal);

// Load user when API with userId route parameter is hit
router.param('userId', userCtrl.load);

export default router;
