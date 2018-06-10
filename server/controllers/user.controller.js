// @flow

import httpStatus from 'http-status';
import Chatkit from 'pusher-chatkit-server';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import APIError from '../helpers/APIError';
import photos from '../helpers/photos';
import config from '../config/config';
import User, { UserDoc } from '../models/user.model';
import Follow from '../models/follow.model';
import DefaultFollow from '../models/defaultFollow.model';
import authCtrl from './auth.controller';
import mailCtrl from './mail.controller';
import followController from './follow.controller';

let ckInst;
if (config.env == 'production') {
  ckInst = new Chatkit({
    instanceLocator: config.chatkit.instanceLocator,
    key: config.chatkit.key,
  });
}

declare class session$Request extends express$Request {
  user: UserDoc;
  file: File;
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
 * GET /api/users/:userId
 *
 * @property {*} req - express session
 * @property {*} req.params - express session parameters
 * @property {MongoId} req.params.userId
 */
async function get(req: session$Request, res: express$Response) {
  let doc = _prepareUserJson(req.user);
  const followers = await Follow.find({
    following: req.params.userId,
  }).populate('follower');
  const following = await Follow.find({
    follower: req.params.userId,
  }).populate('following');

  doc = {
    ...doc,
    followersCount: followers.filter(f => f.follower !== null).length,
    followingCount: following.filter(f => f.following !== null).length,
  };
  return res.json(doc);
}

/**
 * Get user's personal info
 *
 * GET /api/users/:userId/personal
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express parameters
 * @property {ObjectId} req.params.userId
 */
function getPersonal(req: session$Request, res: express$Response) {
  const doc = _prepareUserJson(req.user);
  return res.json({
    ...doc,
    paymentInfo: req.user.paymentInfo,
    shippingAddress: req.user.shippingAddress,
  });
}

/**
 * Create new user
 *
 * POST /api/users
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {string} req.body.username
 * @property {string} req.body.emailAddress
 * @property {string} req.body.password (salted and hashed)
 * @property {string=} req.body.mobileNumber
 * @property {string=} req.body.pushToken
 */
async function create(
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

  const { body } = req;

  if (body.mobileNumber) doc.mobileNumber = body.mobileNumber;
  if (body.platform) doc.platform = body.platform;
  if (body.pushToken) doc.pushToken = body.pushToken;

  const user = new User(doc);

  User.findOne({
    $or: [
      // mongoose changes the email to lowercase
      { emailAddress: req.body.emailAddress.toLowerCase() },
      { username: req.body.username },
    ],
  })
    .then((existingUser: UserDoc) => {
      if (existingUser) {
        const APIerr = new APIError(
          'An account with the same email address or username exists.',
          httpStatus.BAD_REQUEST
        );
        throw APIerr;
      }

      if (body.emailAddress.startsWith('onovaapp')) {
        user.accountStatus = 'verified';
      }

      return user.save().then(async (savedUser: UserDoc) => {
        // if we should Auto Follow certain users by default
        if (config.DEFAULT_FOLLOW) {
          followDefaultUsers(savedUser)
            .then((num: Number) => {
              if (num) debug(`followed ${num} default users`);
            })
            .catch(e => console.error(e));
        }

        if (config.env == 'production') {
          try {
            await ckInst.createUser({
              id: savedUser._id,
              name: savedUser.username,
            });
            console.log('chatkit user created');
          } catch (err) {
            console.error(err);
          }
        } else {
          debug('skipping pusher createUser()');
        }

        if (body.emailAddress.startsWith('onovaapp')) {
          const payload = _prepareUserJson(savedUser);
          return res.status(httpStatus.CREATED).json({
            data: payload,
            token: `JWT ${authCtrl.generateToken(payload)}`,
          });
        }

        return mailCtrl
          .sendVerificationEmail(savedUser.emailAddress, savedUser)
          .then(() => {
            const payload = _prepareUserJson(savedUser);
            return res.status(httpStatus.CREATED).json({
              data: payload,
              token: `JWT ${authCtrl.generateToken(payload)}`,
            });
          });
      });
    })
    .catch(e => next(e));
}

/**
 * A new user follows the number of users
 */
function followDefaultUsers(newUser: UserDoc): Promise<null | Error | number> {
  return new Promise((resolve, reject) => {
    DefaultFollow.find()
      .then(users => {
        if (users.length == 0) {
          // FIXME: hide error in a better way - see internalFollow() method
          // return reject(new Error('there are no default users to follow'));
          return resolve();
        }
        return users;
      })
      .then(async follows => {
        for (const follow of follows) {
          await followController
            .internalFollow(newUser, follow.user)
            .catch(err => console.error(err));
        }
        resolve(follows.length);
      })
      .catch(err => reject(err));
  });
}

/**
 * Update existing user - Protected route
 *
 * PUT /api/users/:userId
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {string=} req.body.bio
 * @property {string=} req.body.displayName
 * @property {string=} req.body.emailAddress
 * @property {string=} req.body.mobileNumber
 * @property {string=} req.body.password
 * @property {string=} req.body.platform
 * @property {string=} req.body.pushToken
 * @property {string=} req.body.facebook
 * @property {string=} req.body.accessToken
 * @property {string=} req.body.username
 * @property {string=} req.body.exp_month
 * @property {string=} req.body.exp_year
 * @property {string=} req.body.last_four
 * @property {any=} req.body.shippingAddress
 */
function update(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { body, user } = req;

  if (body.bio) user.bio = body.bio;
  if (body.displayName) user.displayName = body.displayName;
  if (body.mobileNumber) user.mobileNumber = body.mobileNumber;
  // update password (automatically hashed on save() hook)
  if (body.password) user.password = body.password;
  if (body.platform) user.platform = body.platform;
  if (body.pushToken) user.pushToken = body.pushToken;
  if (body.facebook) {
    user.facebook = body.facebook;
    user.tokens.push({
      accessToken: body.accessToken,
      kind: 'facebook',
    });
  }
  if (body.shippingAddress) user.shippingAddress = body.shippingAddress;

  if (body.last_four || body.exp_month || body.exp_year) {
    user.paymentInfo.last_four = body.last_four;
    user.paymentInfo.exp_month = body.exp_month;
    user.paymentInfo.exp_year = body.exp_year;
  }

  let Promises = [];

  // updating email address
  if (body.emailAddress && user.emailAddress !== body.emailAddress) {
    user.emailAddress = body.emailAddress.toLowerCase();
    Promises.push(
      new Promise((resolve, reject) => {
        User.findOne(
          // mongoose changes the email to lowercase
          { emailAddress: body.emailAddress.toLowerCase() },
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

  if (req.file) {
    if (config.env == 'test') {
      debug('skipping profilePic upload to GCS');
      Promises.push(
        new Promise((resolve, reject) => {
          User.findByIdAndUpdate(req.user._id, {
            $set: { profilePic: req.file.originalname },
          })
            .exec()
            .then(async doc => {
              if (doc) {
                debug('profilePic updated for user:', doc._id);
                if (config.env == 'production') {
                  try {
                    await ckInst.updateUser({
                      id: doc._id,
                      avatarURL: req.file.originalname,
                    });
                    console.log('chatkit user created');
                  } catch (err) {
                    console.error(err);
                    return reject(err);
                  }
                }
                return resolve(doc);
              }
              reject('no user found');
            });
        })
      );
    } else {
      Promises.push(
        new Promise((resolve, reject) => {
          photos
            .uploadProfilePic(req.user, req.file)
            .then(cloudStoragePublicUrl => {
              return User.findByIdAndUpdate(req.user._id, {
                $set: { profilePic: cloudStoragePublicUrl },
              })
                .exec()
                .then(doc => {
                  if (doc) {
                    debug('profilePic updated for user:', doc._id);
                    resolve(doc);
                  } else {
                    reject('no error found');
                  }
                });
            })
            .catch(err => {
              debug('Error saving user profilePic', err);
              reject(err);
            });
        })
      );
    }
  }

  return Promise.all(Promises)
    .then(() => user.save())
    .then(savedUser => res.json(savedUser))
    .then(() => debug(`Username: ${user.username} saved.`))
    .catch(error => {
      return next(error);
    });
}

function escapeRegex(text) {
  return text.replace(/[^A-Za-z0-9_]/g, '\\$&');
}

/**
 * Get list of users.
 *
 * GET /api/users
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {number} req.query.limit Limit number of users to be returned.
 */
function list(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, u } = req.query;

  if (!u) {
    // use static method from UserSchema
    // flow-disable-next-line
    return User.list({ limit })
      .then(users => res.json(users.map(_prepareUserJson)))
      .catch(e => next(e));
  }

  const regex = new RegExp(escapeRegex(u), 'gi');
  User.find({ username: regex, accountStatus: { $nin: ['deleted', 'banned'] } })
    .select('_id accountStatus displayName username profilePic bio')
    .then(users => {
      if (!users) {
        return res.json({});
      }
      return res.json(users);
    })
    .catch(e => {
      const APIerr = new APIError(e, httpStatus.INTERNAL_SERVER_ERROR);
      next(APIerr);
    });
}

/**
 * Delete user - Protected route
 *
 * DELETE /api/users/:userId
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express params parameters
 * @property {string} req.params.userId
 */
function remove(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const user = req.user;

  User.findOneAndUpdate(
    { _id: user._id },
    { accountStatus: 'deleted', deletedAt: new Date() },
    { new: true }
  )
    .then(updatedUser => res.json(updatedUser))
    .catch(e => next(e));
}

/**
 * @private
 *
 * Limit number of fields send back for a user - Un-protected data / no auth
 */
function _prepareUserJson(user: UserDoc): Object {
  return {
    _id: user._id,
    accountStatus: user.accountStatus,
    bio: user.bio,
    displayName: user.displayName,
    emailAddress: user.emailAddress,
    facebook: user.facebook,
    tokens: user.tokens,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    profilePic: user.profilePic,
    ratingsTotal: user.ratingsTotal,
    reviewsCount: user.reviewsCount,
    username: user.username,
  };
}

export default { load, get, getPersonal, create, update, list, remove };
