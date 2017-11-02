// @flow

import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';

import User from '../models/user.model';
import APIError from '../helpers/APIError';
import config from '../config/config';
import mail from './mail.controller';
import { generateToken } from '../controllers/auth.controller';

/**
 * Load user and append to req.
 */
function load(req, res, next, id) {
  // use static method from UserSchema
  User.get(id)
    .then((user) => {
      req.user = user;
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
 * @property {string} req.body.displayName
 * @property {string} req.body.emailAddress
 * @property {string} req.body.password - (salted and hashed)
 * @property {string} req.body.mobileNumber - (optional)
 * @returns {User}
 */
function create(req, res, next) {
  const doc = {
    username: req.body.username,
    emailAddress: req.body.emailAddress,
    displayName: req.body.displayName,
    password: req.body.password,
    // accountStatus: 'notverified' (default)
  };

  if (req.body.mobileNumber) {
    doc.mobileNumber = req.body.mobileNumber;
  }

  const user = new User(doc);

  User.findOne({ emailAddress: req.body.emailAddress }, (err, existingUser) => {
    if (err) { return next(err); }
    if (existingUser) {
      const APIerr = new APIError('Account with that email address already exists.', httpStatus.BAD_REQUEST, true);
      return next(APIerr);
    }
    user.save()
      .then(savedUser => {
        mail.sendVerificationEmail(savedUser.emailAddress, savedUser);

        const payload = {
          _id: savedUser._id,
          emailAddress: savedUser.emailAddress,
          accountStatus: savedUser.accountStatus
        };
        res.status(201).json({
          token: `JWT ${generateToken(payload)}`,
          user: payload
        });
      })
      .catch(e => next(e));
  });
}

/**
 * Update existing user
 *
 * PUT /api/users/:userId
 *
 * @property {string} req.body.username
 * @property {string} req.body.displayName
 * @property {string} req.body.emailAddress
 * @property {string} req.body.mobileNumber - (optional)
 * @returns {User}
 */
function update(req, res, next) {
  const user = req.user;
  user.username = req.body.username;
  user.displayName = req.body.displayName;
  user.emailAddress = req.body.emailAddress;

  if (req.body.mobileNumber) {
    user.mobileNumber = req.body.mobileNumber;
  }

  // update password

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

  user.remove()
    .then(deletedUser => res.json(deletedUser))
    .catch(e => next(e));
}

export default { load, get, create, update, list, remove };
