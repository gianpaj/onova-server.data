// @flow

import express from 'express';
import validate from 'express-validation';
import passport from 'passport';
import httpStatus from 'http-status';
const request = require('request');
const insta = require('../helpers/instagram.auth').instagram();

import config from '../config/config';
import paramValidation from '../config/validation/auth.validation';
import authCtrl from '../controllers/auth.controller';
import { User } from '../models';
import APIError from '../helpers/APIError';
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
 * GET /api/auth/get-token
 */
router.route('/get-token').get(validate(paramValidation.cardToken), authCtrl.getTokenForRequestingCardId);

/**
 * GET /api/auth/activate/:token
 *
 * Activate user after clicking on email verification link
 */
router.route('/activate/:token').get(validate(paramValidation.activate), authCtrl.activate);

/**
 * POST /api/auth/reset
 *
 * Request password reset by email
 */
router.route('/reset').post(validate(paramValidation.requestReset), authCtrl.requestPassReset);

router
  .route('/reset/:token')
  // GET /api/auth/reset/:token - Render page to change password
  .get(authCtrl.resetPage)

  // POST /api/auth/reset/:token - Change user password
  .post(validate(paramValidation.resetForm), authCtrl.resetFormSubmit);

// router.route('/facebook').get(passport.authenticate('facebook'));

// router.route('/facebook/return').get(
//   passport.authenticate('facebook', { failureRedirect: '/uploader' })
//   // function(req, res) {
//   //   res.redirect('/');
//   // }
// );

// $FlowFixMe
router.route('/vk').get((req, res, next) => {
  const { code, onovaUserId } = req.query;
  const redirectURL = `https://onova.co/api/auth/vk%3FonovaUserId%3D${onovaUserId}`;

  request(
    `https://oauth.vk.com/access_token?client_id=${config.VK_APP_ID}&client_secret=${
      config.VK_SECRET_KEY
    }&redirect_uri=${redirectURL}&code=${code}`,
    async (resErr, response, body) => {
      try {
        const { access_token, error } = JSON.parse(body);
        if (resErr || error) throw new APIError('Wrong with VK', httpStatus.INTERNAL_SERVER_ERROR);

        const user = await User.findById(onovaUserId);
        if (!user) throw new APIError('Wrong User id', httpStatus.BAD_REQUEST);

        user.tokens.push({
          accessToken: access_token,
          kind: 'vk',
        });
        await user.save();
        res.send('<script>window.close()</script>');
      } catch (err) {
        console.error(err);
        if (!(err instanceof APIError)) err = new APIError('Error VK auth', 500);
        next(err);
      }
    }
  );
});

const getAuthUrl = function(req, res) {
  insta.use({
    app_id: config.INSTAGRAM_ID,
    client_secret: config.INSTAGRAM_SECRET,
  });
  res.redirect(
    insta.get_authorization_url(config.INSTAGRAM_CALLBACK_URL, {
      scope: ['user_profile'],
      response_type: 'code',
      // state: 'a state',
    })
  );
};

// GET /api/auth/instagram
//   Redirect the user to instagram.com. After authorization, Instagram
//   will redirect the user back to this application at /api/auth/instagram/callback
router.route('/instagram').get(getAuthUrl);

// GET /api/auth/instagram/callback
router.route('/instagram/callback').get(authCtrl.instagramAuthenticate);

export default router;
