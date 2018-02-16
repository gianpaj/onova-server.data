import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/user.validation';
import followCtrl from '../controllers/follow.controller';

// loads Authenticated user document in `req.user`
const requireAuth = passport.authenticate('jwt', { session: false });

const router = express.Router();

// router
//   .route('/')
//   // GET /api/users - Get list of users
//   .get(userCtrl.list)

//   // POST /api/users - Create new user
//   .post(validate(paramValidation.createUser), userCtrl.create);

// router
//   .route('/:userId')
//   // GET /api/users/:userId - Get user
//   .get(userCtrl.get)

//   // PUT /api/users/:userId - Update user - Protected route
//   .put(
//     photos.uploadMulter.single('profilePic'),
//     validate(paramValidation.updateUser),
//     requireAuth,
//     userCtrl.update
//   )

//   // DELETE /api/users/:userId - Delete user - Protected route
//   .delete(requireAuth, userCtrl.remove);

router
  .route('/:userId/follow')

  // GET /api/users/:userId/follow - Follow user
  .post(requireAuth, followCtrl.follow);

router
  .route('/:userId/unfollow')

  // GET /api/users/:userId/follow - Unfollow user
  .post(requireAuth, followCtrl.unfollow);

// Load user when API with userId route parameter is hit
router.param('userId', validate(paramValidation.updateUser));

export default router;
