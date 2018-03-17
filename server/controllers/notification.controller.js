// @flow

import httpStatus from 'http-status';
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import APIError from '../helpers/APIError';
import config from '../config/config';
import { sendPush } from '../helpers/push';
import { UserDoc } from '../models/user.model';
import Notification, { NotificationDoc } from '../models/notification.model';

declare class session$Request extends express$Request {
  user: UserDoc;
}

export class NotifPayload {
  data: ?{
    text: ?string,
    senderName: ?string,
  };
  notifI18n: string;
  targetUser: string;
  triggeredBy: string;
  triggeredType: string;
  onlyPush: ?boolean;
}

/**
 * Get user's notifications
 *
 * GET /api/users/notifications
 *
 * @property {*} req - express session
 * @property {*} req.query - Express query parameters
 * @property {MongoId} req.query.lastId
 * @property {number} req.query.limit Limit number of notifications to be returned
 */
function get(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  let DBquery = { targetUser: req.user._id };
  const { limit = 50, lastId } = req.query;

  // for pagination - results are excluding the lastId`
  if (lastId) {
    DBquery = { ...DBquery, _id: { $gte: lastId } };

    Notification.findById(lastId)
      .then(notif => {
        if (!notif) {
          throw new APIError('Notification not found.', httpStatus.NOT_FOUND);
        }
        Notification.find(DBquery)
          .sort({ _id: -1 }) // faster than createdAt: -1 - same ordering
          .limit(+limit)
          .then(data => res.json({ data }))
          .catch(e => next(e));
      })
      .catch(e => next(e));
  } else {
    Notification.find(DBquery)
      .sort({ _id: -1 }) // faster than createdAt: -1 - same ordering
      .limit(+limit)
      .then(data => res.json({ data }))
      .catch(e => next(e));
  }
}

/**
 * Create a new notification for user's notification screen and optionally schedule a push notification
 *
 * @property {*} notif
 * @property {any} notif.data
 * @property {string} notif.notifI18n
 * @property {MongoId} notif.targetUser
 * @property {MongoId} notif.triggeredBy
 * @property {string} notif.triggeredType User|Product|Order
 * @property {boolean} notif.onlyPush (default false)
 */
function createNotification(notif: notifPayload): Promise<null> {
  const {
    data,
    notifI18n,
    targetUser,
    triggeredBy,
    triggeredType,
    onlyPush,
  } = notif;

  return new Promise((resolve, reject) => {
    // New follower
    if (triggeredType == 'User') {
      sendPush({
        data,
        notifI18n,
        targetUser,
        triggeredBy,
        triggeredType,
      })
        .then(() => {
          debug(config.JOBNAMES.PUSHFOLLOW, 'Job successfully saved');
          resolve();
        })
        .catch(err => {
          console.error(err);
          reject(err);
        });

      if (!onlyPush) {
        Notification.create({
          data,
          notifI18n,
          targetUser,
          triggeredBy,
          triggeredType,
        })
          .then(doc => {
            resolve(doc);
          })
          .catch(e => reject(e));
      }
    } else if (triggeredType == 'Product') {
      // New comment notification to seller
      sendPush({
        data,
        targetUser,
        triggeredBy,
        triggeredType,
        message: shorten(data.text, 40),
      })
        .then(() => {
          debug(config.JOBNAMES.PUSHCOMMENT, 'Job successfully saved');
          resolve();
        })
        .catch(err => {
          console.error(err);
          reject(err);
        });

      if (!onlyPush) {
        Notification.create({
          data,
          notifI18n,
          targetUser,
          triggeredBy,
          triggeredType,
        })
          .then(doc => {
            resolve(doc);
          })
          .catch(e => reject(e));
      }
    } else if (triggeredType == 'Order') {
      // New Order
      sendPush({
        targetUser,
        triggeredBy,
        triggeredType,
        message: notifI18n,
      })
        .then(() => {
          debug(config.JOBNAMES.PUSHORDER, 'Job successfully saved');
          resolve();
        })
        .catch(err => {
          console.error(err);
          reject(err);
        });
      Notification.create({
        data,
        notifI18n,
        targetUser,
        triggeredBy,
        triggeredType,
      })
        .then(doc => {
          resolve(doc);
        })
        .catch(e => reject(e));
    }
  });
}

/**
 * Delete a notification. For example, when a comment is deleted
 *
 * @property {string} type The type of notification (Comment, )
 * @property {string} id
 */
function removeNotification(type: string, id: string): Promise<null> {
  return new Promise((resolve, reject) => {
    if (type == 'Comment') {
      Notification.findOne({ 'data.commentId': id })
        .then((notif: NotificationDoc) => {
          if (!notif) {
            const err = new Error('Notification not found');
            return reject(err);
          }

          // if (req.user._id.toString() !== notif.targetUser.toString()) {
          //   const err = new Error('Cannot delete other people`s notification');
          //   return reject(err);
          // }

          notif
            .remove()
            .then(() => resolve())
            .catch(e => reject(e));
        })
        .catch(e => reject(e));
    }
  });
}

/**
 * Shorten string and add elipses character (…) if it's longer
 */
function shorten(str: string, maxLength: number): string {
  if (str.length < maxLength) {
    return str;
  }
  let trimmedString = str.substr(0, maxLength);
  trimmedString = trimmedString.substr(
    0,
    Math.min(trimmedString.length, trimmedString.lastIndexOf(' '))
  );
  return `${trimmedString}\…`;
}

export default {
  get,
  createNotification,
  removeNotification,
};
