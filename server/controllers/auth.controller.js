import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import passport from 'passport';

import User from '../models/user.model';
import Verification from '../models/verification.model';
import APIError from '../helpers/APIError';
import config from '../../config/config';

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
    if (err) { return next(err); }
    if (!user) {
      const APIerr = new APIError('Authentication error', httpStatus.UNAUTHORIZED, true);
      return next(APIerr);
    }
    //?
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      const payload = {
        _id: user._id,
        emailAddress: user.emailAddress,
        accountStatus: user.accountStatus
      };
      return res.json({
        token: `JWT ${generateToken(payload)}`,
        user: payload
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
    user: req.user,
    num: Math.random() * 100
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

  Verification.findOne({resetToken: token})
    .populate('user')
    .exec((err, verDoc) => {
      let data;
      if (err) throw err;
      if (!verDoc || !verDoc.user) {
        data = {
          heading: 'There was an issue activating your account',
          paragragh: 'There was something wrong with the link you received. Note that it expires after 24 hours. Please request a new one from the App or if email <a href="mailto:hello@onova.co">hello@onova.co</a> for support.'
        }
      } else if (verDoc.user.accountStatus == 'notverified') {
        data = {
          heading: 'Account activated!',
          paragragh: `Hi five ${verDoc.user.displayName}! Your account is now activated (${verDoc.user.emailAddress}).`
        };

        //if token exists, activate user
        verDoc.user.accountStatus = 'verified';
        verDoc.user.save();

        verDoc.remove();

      } else if (verDoc.user.accountStatus == 'verified') {
        data = {
          heading: 'Account is already activated!',
          paragragh: `Double hi five ${verDoc.user.displayName}! Your account is already activated (${verDoc.user.emailAddress}).`
        };
      }
      return res.render('activation', data);
    });

}

export default { login, getRandomNumber, activate, generateToken };
