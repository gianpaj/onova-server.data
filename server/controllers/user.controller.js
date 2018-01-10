// @flow

import httpStatus from 'http-status';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import APIError from '../helpers/APIError';
import User, { UserDoc } from '../models/user.model';
import authCtrl from './auth.controller';
import mailCtrl from './mail.controller';

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * Load user and append to req. object
 */
function load(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction,
  id: string
) {
  // use static method from UserSchema
  // flow-disable-next-line
  User.get(id)
    .then((user: UserDoc) => {
      req.user = user;
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get user
 *
 * GET /api/users/:userId - ObjectId
 *
 * @property {string} req.params.userId
 */
function get(req: session$Request, res: express$Response) {
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
function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
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
    (err, existingUser: UserDoc) => {
      if (err) {
        return next(err);
      }
      if (existingUser) {
        const APIerr = new APIError(
          'An account with the same email address or username exists.',
          httpStatus.BAD_REQUEST
        );
        return next(APIerr);
      }
      user
        .save()
        .then((savedUser: UserDoc) => {
          return mailCtrl
            .sendVerificationEmail(savedUser.emailAddress, savedUser)
            .then(() => {
              const payload = _prepareUserJson(savedUser);
              return res.status(201).json({
                token: `JWT ${authCtrl.generateToken(payload)}`,
                data: payload,
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
 * @property {string} req.body.last_four - (optional)
 * @property {string} req.body.exp_month - (optional)
 * @property {string} req.body.exp_year - (optional)
 */
function update(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const body = req.body;
  const user = req.user;
  user.displayName = body.displayName;

  if (body.mobileNumber) {
    user.mobileNumber = body.mobileNumber;
  }
  if (body.last_four) {
    user.paymentInfo.last_four = body.last_four;
  }
  if (body.exp_month) {
    user.paymentInfo.exp_month = body.exp_month;
  }
  if (body.exp_year) {
    user.paymentInfo.exp_year = body.exp_year;
  }

  // update password (automatically hashed on save())
  if (body.password) {
    user.password = body.password;
  }

  let Promises = [];

  // updating email address
  if (body.emailAddress && user.emailAddress !== body.emailAddress) {
    user.emailAddress = body.emailAddress;
    Promises.push(
      new Promise((resolve, reject) => {
        User.findOne(
          { emailAddress: body.emailAddress },
          (err, existingUser) => {
            if (err) {
              return reject(err);
            }
            if (existingUser) {
              const APIerr = new APIError(
                'An account with the same email address exists.',
                httpStatus.BAD_REQUEST
              );
              return reject(APIerr);
            }
            mailCtrl.resendVerificationEmail(user.emailAddress, user);
            user.accountStatus = 'notverified';
            debug(`account ${user._id} is awaiting for email verification`);
            // save user with new email address only if there is no duplicate key error
            resolve();
          }
        );
      })
    );
  }
  // updating username
  if (body.username && user.username != body.username) {
    user.username = body.username;
    Promises.push(
      new Promise((resolve, reject) => {
        User.findOne({ username: body.username }, (err, existingUser) => {
          if (err) {
            return reject(err);
          }
          if (existingUser) {
            const APIerr = new APIError(
              'An account with the same username exists.',
              httpStatus.BAD_REQUEST
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
    .then(() => debug(`Username: ${user.username} saved.`))
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
function list(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, skip = 0 } = req.query;
  // use static method from UserSchema
  // flow-disable-next-line
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
function remove(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const user = req.user;

  user
    .remove()
    .then(deletedUser => res.json(deletedUser))
    .catch(e => next(e));
}

/**
 * Limit number of fields send back for a user
 * (private)
 */
function _prepareUserJson(user: UserDoc): Object {
  const json = {
    _id: user._id,
    username: user.username,
    emailAddress: user.emailAddress,
    accountStatus: user.accountStatus,
  };
  return json;
}

export default { load, get, create, update, list, remove };
