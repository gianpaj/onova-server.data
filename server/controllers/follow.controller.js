// @flow

import httpStatus from 'http-status';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import APIError from '../helpers/APIError';
import User, { UserDoc } from '../models/user.model';
import Follow, { FollowDoc } from '../models/follow.model';

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * Create new following relationship
 *
 * POST /api/users/:userId/follow
 *
 * @property {*} req Express request
 * @property {*} req.params Express params parameters
 * @property {string} req.params.userId The target user to be followed
 */
function follow(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const targetUserId = req.params.userId;

  if (req.user._id.toString() === targetUserId.toString()) {
    const APIerr = new APIError(
      'Cannot follow yourself',
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  User.findById(targetUserId)
    .then((targetUser: UserDoc) => {
      if (!targetUser) {
        const APIerr = new APIError(
          'Error following a user',
          httpStatus.BAD_REQUEST
        );
        throw APIerr;
      }
      return targetUser;
    })
    .then(targetUser => {
      const doc = new Follow({
        follower: req.user._id,
        following: targetUser._id,
      });

      return doc.save().then(savedDoc => savedDoc);
    })
    .then(savedDoc => {
      return res.status(httpStatus.CREATED).json({ data: savedDoc });
    })
    .catch(e => next(e));
}

/**
 * Delete a following relationship
 *
 * POST /api/users/:userId/unfollow
 *
 * @property {*} req Express request
 * @property {*} req.params Express params parameters
 * @property {string} req.params.userId The target user to be followed
 */
function unfollow(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const targetUserId = req.params.userId;

  if (req.user._id.toString() === targetUserId.toString()) {
    const APIerr = new APIError(
      'Cannot unfollow yourself',
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  User.findById(targetUserId)
    .then((targetUser: UserDoc) => {
      if (!targetUser) {
        const APIerr = new APIError(
          'Error unfollowing a user',
          httpStatus.BAD_REQUEST
        );
        throw APIerr;
      }
      return targetUser;
    })
    .then(targetUser => {
      return Follow.findOne({
        follower: req.user._id,
        following: targetUser._id,
      });
    })
    .then(followDoc => {
      return followDoc.remove();
    })
    .then((deletedDoc, numberAffected, rawResponse) => {
      console.log(numberAffected);
      console.log(rawResponse);
      return res.status(httpStatus.CREATED).json({ data: deletedDoc });
    })
    .catch(e => next(e));
}

export default {
  follow,
  unfollow,
};
