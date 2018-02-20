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
 * Get follow document to check if the requestor is following :userId
 *
 * GET /api/users/:userId/follow
 *
 * @property {*} req - express session
 * @property {*} req.params - express session parameters
 * @property {MongoId} req.params.userId
 */
function get(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const targetUserId = req.params.userId;

  if (req.user._id.toString() === targetUserId.toString()) {
    const APIerr = new APIError(
      'Cannot follow thyself',
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  Follow.findOne({
    follower: req.user._id,
    following: req.params.userId,
  })
    .then(followDoc => {
      if (!followDoc) {
        const APIerr = new APIError('Not following', httpStatus.NOT_FOUND);
        return next(APIerr);
      }
      return res.json({ data: followDoc });
    })
    .catch(e => next(e));
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
      'Cannot follow thyself',
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

      return doc.save();
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
      'Cannot unfollow thyself',
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
    .then((followDoc: FollowDoc) => {
      return followDoc.remove();
    })
    .then(deletedDoc => {
      return res.status(httpStatus.NO_CONTENT).json({ data: deletedDoc });
    })
    .catch(e => next(e));
}

/**
 * Get list of followers of a specific user
 *
 * GET /api/users/:userId/followers
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express params parameters
 * @property {string} req.params.userId
 * @property {*} req.query - Express query parameters
 * @property {number} req.query.skip Number of users to be skipped.
 * @property {number} req.query.limit Limit number of users to be returned.
 */
function listFollowers(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, skip = 0 } = req.query;

  const DBquery = { following: req.params.userId };

  // use static method from FollowSchema
  // flow-disable-next-line
  Follow.list({ DBquery, limit, skip })
    .then(follows => res.json({ data: follows }))
    .catch(e => next(e));
}

/**
 * Get list of users a specific user is following
 *
 * GET /api/users/:userId/following
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express params parameters
 * @property {string} req.params.userId
 * @property {*} req.query - Express query parameters
 * @property {number} req.query.skip Number of users to be skipped.
 * @property {number} req.query.limit Limit number of users to be returned.
 */
function listFollowing(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, skip = 0 } = req.query;

  const DBquery = { follower: req.params.userId };

  // use static method from FollowSchema
  // flow-disable-next-line
  Follow.list({ DBquery, limit, skip })
    .then(follows => res.json({ data: follows }))
    .catch(e => next(e));
}

export default {
  get,
  follow,
  unfollow,
  listFollowers,
  listFollowing,
};
