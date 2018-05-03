// @flow

import httpStatus from 'http-status';

const debug = require('debug')('express-mongoose-es6-rest-api:index');
import APIError from '../helpers/APIError';
import User, { UserDoc } from '../models/user.model';
import Follow, { FollowDoc } from '../models/follow.model';
import DefaultFollow from '../models/defaultFollow.model';
import notifCtrl, {
  NotifPayload,
} from '../controllers/notification.controller';

const i18n = {
  newFollower: 'started following you',
};

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

  internalFollow(req.user, targetUserId)
    .then(savedDoc => {
      return res.status(httpStatus.CREATED).json({ data: savedDoc });
    })
    .catch(e => {
      if (e.message == 'Error following a user') {
        const APIerr = new APIError(e.message, httpStatus.BAD_REQUEST);
        return next(APIerr);
      }
      next(e);
    });
}

/**
 * Follow a user by _id or username and create a Notification
 *
 * @param {UserDoc} sender
 * @param {String} targetUser _id or username
 */
function internalFollow(sender: UserDoc, targetUser: String): Promise<any> {
  // search by userId and username
  return User.findOne({
    $or: [{ username: targetUser }, { _id: targetUser }],
  })
    .then((targetUser: UserDoc) => {
      if (!targetUser) {
        throw new Error('Error following a user');
      }
      return targetUser;
    })
    .then(targetUser => {
      const notif: NotifPayload = {
        data: {
          senderName: sender.username,
        },
        notifI18n: i18n.newFollower,
        targetUser: targetUser._id,
        triggeredBy: sender._id,
        triggeredType: 'User',
        onlyPush: false,
      };

      notifCtrl
        .createNotification(notif)
        .then(() => {
          debug('comment notification created');
        })
        .catch(err => {
          console.error(err);
        });

      const doc = new Follow({
        follower: sender._id,
        following: targetUser._id,
      });

      return doc.save();
    })
    .then(follow => {
      DefaultFollow.updateOne(
        { user: follow.following },
        {
          $inc: { initialFollowersCount: 1 },
        }
      ).then(res => {
        if (res.nModified == 1) {
          return void debug('increase initial count for defaultFollower');
        }
        // FIXME: hide error in a better way - see followDefaultUsers() method
        // console.error('error incrementing initialFollowersCount');
      });
      return follow;
    });
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
      return res.json({ data: deletedDoc });
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
  Follow.list({ DBquery, limit, skip, me: req.user._id.toString() })
    .then(async followers => {
      if (followers) {
        // filter followers that not longer exist (populate returns null)
        followers = followers.filter(f => f.follower !== null);
        // TODO: filter followers that are deleted
        // get the list of followers ids of the queried User
        const ids = followers.map(f => f.follower._id.toString());
        // get the list of users I follow based on that list ^
        let myFollowings = await Follow.find({
          follower: req.user._id.toString(),
          following: { $in: ids },
        });
        myFollowings = myFollowings.map(f => f.following.toString());
        followers = followers.map((f: FollowDoc) => {
          f = f.toJSON();
          let doc = {
            ...f.follower,
            dateCreated: f.dateCreated,
            amIAFollower: false,
          };
          if (
            myFollowings &&
            myFollowings.indexOf(f.follower._id.toString()) > -1
          ) {
            doc.amIAFollower = true;
          }
          return doc;
        });
      }
      res.json({ data: followers });
    })
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
  Follow.list({ DBquery, limit, skip, me: req.user._id.toString() })
    .then(async followings => {
      if (followings) {
        // filter followers that not longer exist (populate returns null)
        followings = followings.filter(f => f.follower !== null);
        // TODO: filter followings that are deleted
        // get the list ids of the queried User is following
        const ids = followings.map(f => f.following._id.toString());
        // get the list of users I follow based on that list ^
        let myFollowings = await Follow.find({
          follower: req.user._id.toString(),
          following: { $in: ids },
        });
        myFollowings = myFollowings.map(f => f.following.toString());
        followings = followings.map((f: FollowDoc) => {
          f = f.toJSON();
          let doc = {
            ...f.following,
            dateCreated: f.dateCreated,
            amIAFollower: false,
          };
          if (myFollowings.indexOf(f.following._id.toString()) > -1) {
            doc.amIAFollower = true;
          }
          return doc;
        });
      }
      res.json({ data: followings });
    })
    .catch(e => next(e));
}

export default {
  get,
  follow,
  internalFollow,
  unfollow,
  listFollowers,
  listFollowing,
};
