// @flow

import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import passport from 'passport';
import axios from 'axios';
import pick from 'lodash/pick';
import querystring from 'querystring';
const debug = require('debug')('server-data:index');

import { User, Verification } from '../models';
import mailCtrl from './mail.controller';
import { scrapeUserPageInfo } from '../helpers/instagram-scraping';
import APIError from '../helpers/APIError';
import config from '../config/config';
import { authenticate } from '../config/passport';
import userCtrl from './user.controller';

/**
 * POST /api/auth/login
 *
 * Returns jwt token if valid emailAddress and password are valid
 *
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function login(req, res, next) {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      const APIerr = new APIError(err.message, httpStatus.UNAUTHORIZED);
      return next(APIerr);
    }
    if (!user) {
      debug(info);
      const APIerr = new APIError('Authentication error', httpStatus.UNAUTHORIZED);
      return next(APIerr);
    }
    //?
    req.logIn(user, err => {
      if (err) {
        return next(err);
      }
      const payload = {
        _id: user._id,
        accountStatus: user.accountStatus,
        displayName: user.displayName,
        emailAddress: user.emailAddress,
        profilePic: user.profilePic,
        username: user.username,
      };
      return res.json({
        token: `JWT ${generateToken(payload)}`,
        data: payload,
      });
    });
  })(req, res, next);
}

/**
 * Responds with a http error or adds user into req.user
 *
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function requireAuth(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (info) {
      let message;
      if (info.name === 'TokenExpiredError') {
        message = 'jwt expired';
      } else {
        message = `Unauthorized ${info.type} user`;
      }
      const APIerr = new APIError(message, httpStatus.UNAUTHORIZED);
      return next(APIerr);
    }
    if (err || !user) {
      const APIerr = new APIError('Unauthorized', httpStatus.UNAUTHORIZED);
      return next(APIerr);
    }
    req.user = user;
    next();
  })(req, res, next);
}

// Generate JWT
function generateToken(payload) {
  const options = {};
  if (config.env === 'test') options.expiresIn = 20; // seconds
  // expiresIn: "2 days",
  return jwt.sign(payload, config.jwtSecret, options);
}

/**
 * GET /api/auth/random-number - (Protected route)
 *
 * Will return random number only if jwt token is provided in header.
 *
 * @param req
 * @param res
 * @returns {*}
 */
function getRandomNumber(req, res) {
  // req.user is assigned by 'passport-jwt' middleware if a valid token is provided
  return res.json({
    data: req.user,
    num: Math.random() * 100,
  });
}

/**
 * GET /api/auth/activate/:token
 *
 * @param {any} req
 * @param {any} res
 * @returns {*}
 */
function activate(req, res) {
  const token = req.params.token;

  Verification.findOne({ resetToken: token })
    .populate('user')
    .exec((err, verDoc) => {
      if (err) throw err;
      const data = {
        title: 'Onova - Email confirmation',
      };
      if (!verDoc || !verDoc.user) {
        // data.heading = 'There was an issue activating your account';
        data.heading = 'Виникла проблема при активації вашого профілю';
        // data.paragraph =
        //   'There was something wrong with the link you received. Note that it expires after 72 hours. Please request a new one from the App or email <a href="mailto:support@onova.co">support@onova.co</a> for support.';
        data.paragraph =
          'Щось не так з посиланням котре ви отримали. Воно стає недійсне через 72 години. Будь ласка спробуйте ще раз з додатку, або напишіть нам на <a href="mailto:support@onova.co">support@onova.co</a>';
        // TODO: update email if link is for Drop
      } else if (verDoc.user.accountStatus == 'notverified') {
        const { username, types } = verDoc.user;

        if (types.includes('reseller')) {
          data.title = 'Drop - Email confirmation';
        }
        data.heading = 'Профіль активовано!'; // Account activated
        data.paragraph = `${username}, Можеш користуватись додатком на повну (${verDoc.user.emailAddress}).`;

        //if token exists, activate user
        verDoc.user.accountStatus = 'verified';
        verDoc.user.save();

        verDoc.remove();
      } else if (verDoc.user.accountStatus == 'verified') {
        // const { username } = verDoc.user;
        // data.heading = 'Account is already activated!';
        data.heading = 'Ваш профіль активовано!!';
        // data.paragraph = `Double hi five ${username}! Your account is already activated (${
        //   verDoc.user.emailAddress
        // }).`;
        data.paragraph = `Вітання, ваш профіль активовано (${verDoc.user.emailAddress}).`;
      }
      return res.render('activation', data);
    });
}

/**
 * GET /api/auth/reset/:token
 *
 * @param {any} req
 * @param {any} res
 * @returns {*}
 */
function resetPage(req, res) {
  const token = req.params.token;

  Verification.findOne({ resetToken: token })
    .populate('user')
    .exec((err, verDoc) => {
      if (err) throw err;
      const data = {
        // title: 'Onova - Password reset',
        title: 'Онова - Заміна паролю',
        // .heading: 'Enter your new password',
        heading: 'Зміна паролю',
        // paragraph: 'Please enter your password twice:',
        paragraph: 'Введи новий пароль двічі:',
        show_form: true,
      };
      if (!verDoc || !verDoc.user) {
        // data.heading = 'There was an issue resetting your password';
        data.heading = 'Виникла проблема при зміні паролю';
        // data.paragraph =
        //   'There was something wrong with the link you received. Note that it expires after 72 hours. Please request a new one from the App or email <a href="mailto:support@onova.co">support@onova.co</a> for support.';
        data.paragraph =
          'Щось не так з посиланням котре ви отримали. Воно стає недійсне через 72 години. Будь ласка спробуйте ще раз з додатку, або напишіть нам на <a href="mailto:support@onova.co">support@onova.co</a>';
        data.show_form = false;
      } else if (verDoc.user.types.includes('reseller')) {
        data.title = 'Drop - Заміна паролю';
      }
      return res.render('pass-reset', data);
    });
}

// TODO: combine this resetFormSubmit and resetPage functions
/**
 * POST /api/auth/reset/:token - submit form
 *
 * @param {any} req
 * @param {any} res
 * @returns {*}
 */
function resetFormSubmit(req, res) {
  const data = {
    // title: 'Onova - Password reset',
    title: 'Онова - Заміна паролю',
    // heading: 'Enter your new password',
    heading: 'Зміна паролю',
    show_form: false,
  };
  if (req.body.password !== req.body.passwordagain) {
    // data.paragraph =
    //   '<div class="alert alert-danger" role="alert">Your passwords did not match.</div>';
    data.paragraph = '<div class="alert alert-danger" role="alert">Ваші паролі не співпали.</div>';
    data.show_form = true;
    return res.render('pass-reset', data);
  }
  const { token } = req.params;

  Verification.findOne({ resetToken: token })
    .populate('user')
    .exec((err, verDoc) => {
      if (err) throw err;
      if (!verDoc || !verDoc.user) {
        // data.heading = 'There was an issue resetting your password';
        data.heading = 'Виникла проблема при зміні паролю';
        return res.status(httpStatus.BAD_REQUEST).render('pass-reset', data);
      }
      if (verDoc.user.types.includes('reseller')) {
        data.title = 'Drop - Заміна паролю';
      }
      data.heading = '';
      data.paragraph = 'Ваш пароль оновлено.';
      // data.paragraph = 'Hi five! Your password has been updated.';

      verDoc.user.password = req.body.password;
      verDoc.user.status = 'verified';

      verDoc.user.save(err => {
        if (err) {
          return next(err);
        }
        verDoc.remove();
        return res.render('pass-reset', data);
      });
    });
}

/**
 * POST /api/auth/reset
 *
 * Send email via Mailjet to reset the account's password
 */
function requestPassReset(req, res, next) {
  User.findOne({ emailAddress: req.body.emailAddress }, (err, existingUser) => {
    if (err) return next(err);
    if (!existingUser) {
      console.log("attempted to reset a user's password with no results:", req.body.emailAddress);
      return res.json({ message: 'Password reset email sent.' });
    }
    mailCtrl.sendResetEmail(req.body.emailAddress, existingUser);

    res.json({ message: 'Password reset email sent.' });
  });
}

/**
 * GET /api/auth/get-token - (Unprotected route)
 *
 * Token to request a card id to UAPAY via webview.
 * Because it's easier to generate on the server than RN client (no crypto node core module)
 */
function getTokenForRequestingCardId(req, res, next) {
  jwt.sign(
    {
      params: {
        clientId: config.UAPAY_CLIENTID_P2P,
        method: req.query.shortCard ? 'createShortCard' : 'createCard',
        enableRedirectResponse: false,
      },
    },
    config.UAPAY_SECRET_P2P,
    (err, jws) => {
      if (err) {
        console.log(err);
        const APIerr = new APIError(err, httpStatus.SERVICE_UNAVAILABLE);
        return next(APIerr);
      }
      res.json({ data: jws });
    }
  );
}

/**
 * https://developers.facebook.com/docs/instagram-basic-display-api/getting-started#step-4--authenticate-the-test-user
 */
async function instagramAuthenticate(req, res, next) {
  const { code, error_reason } = req.query;

  if (error_reason == 'user_denied') {
    return res.render('instagramPostMessage', {
      error: error_reason,
    });
  }

  const postData = {
    app_id: config.INSTAGRAM_ID,
    app_secret: config.INSTAGRAM_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: config.INSTAGRAM_CALLBACK_URL,
    code,
  };
  try {
    // Step 5: Exchange the Code for a Token
    const { data } = await axios.post('https://api.instagram.com/oauth/access_token', querystring.stringify(postData));
    const fields = {
      fields: 'id,username',
      access_token: data.access_token,
    };

    const profileURL = 'https://graph.instagram.com/me?' + querystring.stringify(fields);

    const basicProfile = await axios.get(profileURL);

    // FIXME: if the profile is private
    let profile = await scrapeUserPageInfo(basicProfile.data.username);

    profile = pick(profile, 'biography', 'username', 'full_name', 'id', 'profile_pic_url_hd');
    authenticate(req, data.access_token, profile, (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).json(err);
      }
      const payload = userCtrl.prepareUserJson(user);
      res.render('instagramPostMessage', {
        data: payload,
        token: `JWT ${generateToken(payload)}`,
      });
    });
  } catch (error) {
    console.log('error');
    if (error.response && error.response.data) {
      console.error(error.response.data);
      res.status(500).json(error.response.data);
    } else {
      console.error(error);
      res.status(500).json(error);
    }
  }
}

export default {
  login,
  getRandomNumber,
  activate,
  generateToken,
  instagramAuthenticate,
  requestPassReset,
  requireAuth,
  resetPage,
  resetFormSubmit,
  getTokenForRequestingCardId,
};
