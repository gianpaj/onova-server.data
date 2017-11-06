// @flow

import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import type {$Request, NextFunction} from 'express'

import User from '../models/user.model';
import APIError from '../helpers/APIError';
import config from '../config/config';
import mailCtrl from './mail.controller';
import authCtrl from './auth.controller';

/**
 * Load user and append to req.
 */
function load(req: $Request, res: $Response, next: NextFunction, id: number) {
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
function get(req: $Request, res: $Response) {
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
function create(req: $Request, res: $Response, next: NextFunction) {
  const doc: Object = {
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
        mailCtrl.sendVerificationEmail(savedUser.emailAddress, savedUser);

        const payload = prepareUserJson(savedUser);
        res.status(201).json({
          token: `JWT ${authCtrl.generateToken(payload)}`,
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
function update(req: $Request, res: $Response, next: NextFunction) {
  const user = req.user;
  user.username = req.body.username;
  user.displayName = req.body.displayName;

  if (req.body.mobileNumber) {
    user.mobileNumber = req.body.mobileNumber;
  }

  // update password

  if (user.emailAddress != req.body.emailAddress) {
    user.emailAddress = req.body.emailAddress;
    mailCtrl.resendVerificationEmail(user.emailAddress, user);
    user.accountStatus = 'notverified';
    console.debug(`account ${user._ud} is awaiting for email verification`);
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
function list(req: $Request, res: $Response, next: NextFunction) {
  const { limit = 50, skip = 0 } = req.query;
  User.list({ limit, skip })
    .then(users => res.json(users))
    .catch(e => next(e));
}

/**
 * Delete user.
 * @returns {User}
 */
function remove(req: $Request, res: $Response, next: NextFunction) {
  const user = req.user;

  user.remove()
    .then(deletedUser => res.json(deletedUser))
    .catch(e => next(e));
}

/**
 * Limit number of fields send back for user
 * (private)
 */
function prepareUserJson(user: Object): Object {
  const json = {
    _id: user._id,
    username: user.username,
    emailAddress: user.emailAddress,
    accountStatus: user.accountStatus
  };
  return json;
}

export default { load, get, create, update, list, remove };
