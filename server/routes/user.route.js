import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/user.validation';
import notificationCtrl from '../controllers/notification.controller';
import userCtrl from '../controllers/user.controller';
import photos from '../helpers/photos';

const requireAuth = passport.authenticate('jwt', { session: false });

const router = express.Router();

router
  .route('/notifications')

  // GET /api/users/notifications - Get user's notifications
  .get(validate(paramValidation.notif), requireAuth, notificationCtrl.get);

router
  .route('/')
  // GET /api/users - Get list of users
  .get(userCtrl.list)

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
    userCtrl.update
  )

  // DELETE /api/users/:userId - Delete user - Protected route
  .delete(requireAuth, userCtrl.remove);

router
  .route('/:userId/personal')

  // GET /api/users/:userId/personal - Get user's personal info - Protected route
  .get(requireAuth, userCtrl.getPersonal);

// Load user when API with userId route parameter is hit
router.param('userId', userCtrl.load);

export default router;
