import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import passport from 'passport';

import User from '../models/user.model';
import Verification from '../models/verification.model';
import mailCtrl from './mail.controller';
import APIError from '../helpers/APIError';
import config from '../config/config';

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
      return next(err);
    }
    if (!user) {
      console.debug(info);
      const APIerr = new APIError(
        'Authentication error',
        httpStatus.UNAUTHORIZED,
        true
      );
      return next(APIerr);
    }
    //?
    req.logIn(user, err => {
      if (err) {
        return next(err);
      }
      const payload = {
        _id: user._id,
        emailAddress: user.emailAddress,
        accountStatus: user.accountStatus,
      };
      return res.json({
        token: `JWT ${generateToken(payload)}`,
        data: payload,
      });
    });
  })(req, res, next);
}

// Generate JWT
function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    // expiresIn: 604800 // in seconds
  });
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
      let data = {
        title: 'Onova - Email confirmation',
      };
      if (err) throw err;
      if (!verDoc || !verDoc.user) {
        (data.heading = 'There was an issue activating your account'),
          (data.paragraph =
            'There was something wrong with the link you received. Note that it expires after 24 hours. Please request a new one from the App or email <a href="mailto:hello@onova.co">hello@onova.co</a> for support.');
      } else if (verDoc.user.accountStatus == 'notverified') {
        (data.heading = 'Account activated!'),
          (data.paragraph = `Hi five ${
            verDoc.user.displayName
          }! Your account is now activated (${verDoc.user.emailAddress}).`);

        //if token exists, activate user
        verDoc.user.accountStatus = 'verified';
        verDoc.user.save();

        verDoc.remove();
      } else if (verDoc.user.accountStatus == 'verified') {
        (data.heading = 'Account is already activated!'),
          (data.paragraph = `Double hi five ${
            verDoc.user.displayName
          }! Your account is already activated (${verDoc.user.emailAddress}).`);
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
      let data = {
        title: 'Onova - Password reset',
        show_form: true,
      };
      if (err) throw err;
      if (!verDoc || !verDoc.user) {
        data.heading = 'There was an issue resetting your password';
        data.paragraph =
          'There was something wrong with the link you received. Note that it expires after 24 hours. Please request a new one from the App or email <a href="mailto:hello@onova.co">hello@onova.co</a> for support.';
        data.show_form = false;
      } else {
        data.heading = 'Enter your new password';
        data.paragraph = 'Please enter your password twice:';
      }
      return res.render('pass-reset', data);
    });
}

/**
 * POST /api/auth/reset/:token - submit form
 *
 * @param {any} req
 * @param {any} res
 * @returns {*}
 */
function resetFormSubmit(req, res) {
  let data = {
    title: 'Onova - Password reset',
    heading: 'Enter your new password',
    show_form: false,
  };
  if (req.body.password != req.body.passwordagain) {
    data.paragraph =
      '<div class="alert alert-danger" role="alert">Your passwords did not match.</div>';
    data.show_form = true;
    return res.render('pass-reset', data);
  } else {
    const token = req.params.token;

    Verification.findOne({ resetToken: token })
      .populate('user')
      .exec((err, verDoc) => {
        if (err) throw err;
        if (!verDoc || !verDoc.user) {
          data.heading = 'There was an issue resetting your password';
          return res.status(400).render('pass-reset', data);
        } else {
          data.heading = '';
          data.paragraph = 'Hi five! Your password has been updated.';

          verDoc.user.password = req.body.password;

          verDoc.user.save(err => {
            if (err) {
              return next(err);
            }
            verDoc.remove();
            return res.render('pass-reset', data);
          });
        }
      });
  }
}

/**
 * POST /api/auth/reset
 *
 * Send email via Mailjet to reset the account's password
 */
function requestPassReset(req, res) {
  User.findOne({ emailAddress: req.body.emailAddress }, (err, existingUser) => {
    if (err) {
      return next(err);
    }
    if (!existingUser) {
      console.log(
        "attempted to reset a user's password with no results:",
        req.body.emailAddress
      );
      return res.json({ message: 'Password reset email sent.' });
    }
    mailCtrl.sendResetEmail(req.body.emailAddress, existingUser);

    res.json({ message: 'Password reset email sent.' });
  });
}

export default {
  login,
  getRandomNumber,
  activate,
  generateToken,
  requestPassReset,
  resetPage,
  resetFormSubmit,
};
