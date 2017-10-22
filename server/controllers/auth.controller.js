import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';

import User from '../models/user.model';
import APIError from '../helpers/APIError';
import config from '../../config/config';

/**
 * Returns jwt token if valid emailAddress and password are valid
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
 * This is a protected route. Will return random number only if jwt token is provided in header.
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

export default { login, getRandomNumber };
