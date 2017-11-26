// @flow

import mongoose from 'mongoose';
import httpStatus from 'http-status';
import type { $Request, NextFunction } from 'express';

import User from '../models/user.model';
import APIError from '../helpers/APIError';
import mailCtrl from './mail.controller';
import authCtrl from './auth.controller';

/**
 * Load user and append to req. object
 */
function load(req: $Request, res: $Response, next: NextFunction, id: string) {
  // use static method from UserSchema
  User.get(id)
    .then(user => {
      req.user = user;
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get user
 *
 * GET /api/users/:userId
 *
 * @property {string} req.params.userId
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
 *
 * POST /api/users
 *
 * @property {string} req.body.username
 * @property {string} req.body.emailAddress
 * @property {string} req.body.password - (salted and hashed)
 * @property {string} req.body.mobileNumber - (optional)
 */
function create(req: $Request, res: $Response, next: NextFunction) {
  const doc: Object = {
    username: req.body.username,
    emailAddress: req.body.emailAddress,
    // displayName:  req.body.displayName,
    password: req.body.password,
    // accountStatus: 'notverified' (default)
  };

  if (req.body.mobileNumber) {
    doc.mobileNumber = req.body.mobileNumber;
  }

  const user = new User(doc);

  User.findOne(
    {
      $or: [
        { emailAddress: req.body.emailAddress },
        { username: req.body.username },
      ],
    },
    (err, existingUser) => {
      if (err) {
        return next(err);
      }
      if (existingUser) {
        const APIerr = new APIError(
          'An account with the same email address or username exists.',
          httpStatus.BAD_REQUEST,
          true
        );
        return next(APIerr);
      }
      user
        .save()
        .then((savedUser: mongoose.Document) => {
          return mailCtrl
            .sendVerificationEmail(savedUser.emailAddress, savedUser)
            .then(() => {
              const payload = prepareUserJson(savedUser);
              return res.status(201).json({
                token: `JWT ${authCtrl.generateToken(payload)}`,
                user: payload,
              });
            });
        })
        .catch(e => next(e));
    }
  );
}

/**
 * Update existing user - Protected route
 *
 * PUT /api/users/:userId
 *
 * @property {string} req.body.username
 * @property {string} req.body.displayName
 * @property {string} req.body.emailAddress
 * @property {string} req.body.password - (optional)
 * @property {string} req.body.mobileNumber - (optional)
 */
function update(req: $Request, res: $Response, next: NextFunction) {
  const user = req.user;
  user.displayName = req.body.displayName;

  if (req.body.mobileNumber) {
    user.mobileNumber = req.body.mobileNumber;
  }

  // update password (automatically hashed on save())
  if (req.body.password) {
    user.password = req.body.password;
  }

  let Promises = [];

  // updating email address
  if (user.emailAddress != req.body.emailAddress) {
    user.emailAddress = req.body.emailAddress;
    Promises.push(
      new Promise((resolve, reject) => {
        User.findOne(
          { emailAddress: req.body.emailAddress },
          (err, existingUser) => {
            if (err) {
              return reject(err);
            }
            if (existingUser) {
              const APIerr = new APIError(
                'An account with the same email address exists.',
                httpStatus.BAD_REQUEST,
                true
              );
              return reject(APIerr);
            }
            mailCtrl.resendVerificationEmail(user.emailAddress, user);
            user.accountStatus = 'notverified';
            console.debug(
              `account ${user._id} is awaiting for email verification`
            );
            // save user with new email address only if there is no duplicate key error
            resolve();
          }
        );
      })
    );
  }
  // updating username
  if (user.username != req.body.username) {
    user.username = req.body.username;
    Promises.push(
      new Promise((resolve, reject) => {
        User.findOne({ username: req.body.username }, (err, existingUser) => {
          if (err) {
            return reject(err);
          }
          if (existingUser) {
            const APIerr = new APIError(
              'An account with the same username exists.',
              httpStatus.BAD_REQUEST,
              true
            );
            return reject(APIerr);
          }
          resolve();
        });
      })
    );
  }
  return Promise.all(Promises)
    .then(() => user.save())
    .then(savedUser => res.json(savedUser))
    .then(() => console.debug(`Username: ${user.username} saved.`))
    .catch(error => {
      return next(error);
    });
}

/**
 * Get list of users.
 *
 * GET /api/users
 *
 * @property {number} req.query.skip - Number of users to be skipped.
 * @property {number} req.query.limit - Limit number of users to be returned.
 */
function list(req: $Request, res: $Response, next: NextFunction) {
  const { limit = 50, skip = 0 } = req.query;
  // use static method from UserSchema
  User.list({ limit, skip })
    .then(users => res.json(users))
    .catch(e => next(e));
}

/**
 * Delete user - Protected route
 *
 * DELETE /api/users/:userId
 *
 * @property {string} req.params.userId
 */
function remove(req: $Request, res: $Response, next: NextFunction) {
  const user = req.user;

  user
    .remove()
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
    accountStatus: user.accountStatus,
  };
  return json;
}

export default { load, get, create, update, list, remove };
