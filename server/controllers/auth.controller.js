import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';

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
  // fetch user and test password verification
  User.findOne({ emailAddress: req.body.emailAddress }, (err, user) => {
    if (err) throw err;
    if (user) {
      user.comparePassword(req.body.password, user.password, (err, isMatch) => {
        if (err) throw err;
        if (isMatch) {
          const token = jwt.sign({
            emailAddress: user.emailAddress
          }, config.jwtSecret);
          return res.json({
            token,
            emailAddress: user.emailAddress
          });
        } else {
          const APIerr = new APIError('Authentication error', httpStatus.UNAUTHORIZED, true);
          return next(APIerr);
        }
      });
    } else {
      const APIerr = new APIError('User not found', httpStatus.NOT_FOUND, true);
      return next(APIerr);
    }
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
  // req.user is assigned by jwt middleware if valid token is provided
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

export default { login, getRandomNumber, activate };
