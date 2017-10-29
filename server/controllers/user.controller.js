import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';

import User from '../models/user.model';
import APIError from '../helpers/APIError';
import config from '../../config/config';
import mail from './mail.controller';

/**
 * Load user and append to req.
 */
function load(req, res, next, id) {
  User.get(id)
    .then((user) => {
      req.user = user; // eslint-disable-line no-param-reassign
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get user
 * @returns {User}
 */
function get(req, res) {
  const doc = {
    _id: req.user._id,
    username: req.user.username,
    emailAddress: req.user.emailAddress,
    mobileNumber: req.user.mobileNumber,
  };
  return res.json(doc);
}

/**
 * Create new user
 * @property {string} req.body.username
 * @property {string} req.body.mobileNumber - (optional)
 * @property {string} req.body.emailAddress
 * @property {string} req.body.password
 * @returns {User}
 */
function create(req, res, next) {
  const doc = {
    username: req.body.username,
    emailAddress: req.body.emailAddress,
    password: req.body.password,
    // accountStatus: 'notverified' (default)
  };

  if (req.body.mobileNumber) {
    doc.mobileNumber = req.body.mobileNumber;
  }

  const user = new User(doc);

  user.save()
    .then(savedUser => {
      const user = {
        _id: savedUser._id,
        username: savedUser.username,
        emailAddress: savedUser.emailAddress,
        mobileNumber: savedUser.mobileNumber,
        accountStatus: savedUser.accountStatus
      };
      mail.sendVerificationEmail(savedUser.emailAddress, savedUser);
      res.json(user);
    })
    .catch(e => next(e));
}

/**
 * Update existing user
 * @property {string} req.body.username - The username of user.
 * @property {string} req.body.mobileNumber - The mobileNumber of user (optional).
 * @property {string} req.body.emailAddress - The emailAddress of user.
 * @returns {User}
 */
function update(req, res, next) {
  const user = req.user;
  user.username = req.body.username;
  user.emailAddress = req.body.emailAddress;

  if (req.body.mobileNumber) {
    user.mobileNumber = req.body.mobileNumber;
  }

  if (user.emailAddress != req.body.emailAddress) {
    // resendEmailVerification
    // which sents the accountStatus as 'notverified'
    user.update({accountStatus: 'notverified'}).then(()=>{
      console.log(`account ${user._ud} is awaiting for email verification`);
    })
  }

  user.save()
    .then(savedUser => res.json(savedUser))
    .catch(e => next(e));
}

/**
 * Get user list.
 * @property {number} req.query.skip - Number of users to be skipped.
 * @property {number} req.query.limit - Limit number of users to be returned.
 * @returns {User[]}
 */
function list(req, res, next) {
  const { limit = 50, skip = 0 } = req.query;
  User.list({ limit, skip })
    .then(users => res.json(users))
    .catch(e => next(e));
}

/**
 * Delete user.
 * @returns {User}
 */
function remove(req, res, next) {
  const user = req.user;
  const token = req.headers.authorization.split(' ')[1];

  // eslint-disable-next-line
  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      console.error(err);
      const APIerr = new APIError(err, httpStatus.INTERNAL_SERVER_ERROR, true);
      return next(APIerr);
    }
    if (decoded.emailAddress === user.emailAddress) {
      user.remove()
      .then(deletedUser => res.json(deletedUser))
      .catch(e => next(e));
    } else {
      console.error('Delete user not allowed for', user.emailAddress, 'by', decoded.emailAddress);
      const APIerr = new APIError('Not allowed', httpStatus.FORBIDDEN, true);
      return next(APIerr);
    }
  });
}

export default { load, get, create, update, list, remove };
