// @flow

import User, { UserDoc } from '../models/user.model';
import Product, { ProductDoc } from '../models/product.model';
import Order, { OrderDoc } from '../models/order.model';
import { agenda } from '../config/express';
import config from '../config/config';
import shortid from 'shortid';
import type { notifPayload } from '../controllers/notification.controller';

export function sendPush({
  data,
  notifI18n,
  targetUser,
  triggeredBy,
  triggeredType,
  message,
}: notifPayload): Promise<null> {
  // New follower
  if (triggeredType == 'User') {
    return User.findById(triggeredBy)
      .then(sender => {
        if (!sender) {
          throw new Error('Cannot find sender');
        }

        return User.findById(targetUser)
          .then(target => {
            if (!target) {
              throw new Error('Cannot find target');
            }
            return { sender, target };
          })
          .catch(e => e);
      })
      .then(({ sender, target }: { sender: UserDoc, target: UserDoc }) => {
        const pushData = {
          message: interpolate(notifI18n, { senderName: data.senderName }),
          platform: target.platform,
          pushToken: target.pushToken,
          senderId: sender._id,
          senderName: sender.displayName || sender.username,
          targetUser: target._id,
          triggeredType,
          random: shortid(), // for unique push notification
        };

        if (config.env == 'test') {
          return Promise.resolve();
        }

        const job = agenda.create(config.JOBNAMES.PUSHFOLLOW, pushData);

        return job.save(err => {
          if (err) throw new Error(`Job failed with error: ${err}`);
        });
      })
      .catch(e => {
        console.error(e);
        return e;
      });
  } else if (triggeredType == 'Product') {
    // New comment notification to seller
    return Product.findById(triggeredBy)
      .then(product => {
        if (!product) {
          throw new Error('Cannot find product');
        }

        return User.findById(targetUser)
          .then(target => {
            if (!target) {
              throw new Error('Cannot find target');
            }
            return { product, target };
          })
          .catch(e => e);
      })
      .then(({ product, target }: { product: ProductDoc, target: UserDoc }) => {
        const pushData = {
          message,
          platform: target.platform,
          pushToken: target.pushToken,
          triggeredBy: product._id,
          triggeredType,
          senderName: data.senderName,
          targetUser: target._id,
          random: shortid(), // for unique push notification
        };

        if (config.env == 'test') {
          return Promise.resolve();
        }

        const job = agenda.create(config.JOBNAMES.PUSHCOMMENTS, pushData);

        return job.save(err => {
          if (err) throw new Error(`Job failed with error: ${err}`);
        });
      })
      .catch(e => {
        console.error(e);
        return e;
      });
  } else if (triggeredType == 'Order') {
    // New Order
    return Order.findById(triggeredBy)
      .then(order => {
        if (!order) {
          throw new Error('Cannot find order');
        }

        return User.findById(targetUser)
          .then(target => {
            if (!target) {
              throw new Error('Cannot find target');
            }
            return { order, target };
          })
          .catch(e => e);
      })
      .then(({ order, target }: { order: OrderDoc, target: UserDoc }) => {
        const pushData = {
          message,
          platform: target.platform,
          pushToken: target.pushToken,
          triggeredBy: order._id,
          triggeredType,
          targetUser: target._id,
          random: shortid(), // unique push notification
        };

        if (config.env == 'test') {
          return Promise.resolve();
        }

        const job = agenda.create(config.JOBNAMES.PUSHCOMMENTS, pushData);

        return job.save(err => {
          if (err) throw new Error(`Job failed with error: ${err}`);
        });
      })
      .catch(e => {
        console.error(e);
        return e;
      });
  }
}

/**
 * Interpolate string on variables
 *
 * Example:
 *
 * const template = 'New comment from: ${username}';
 * interpolate(template, { username: 'Jesus' })
 * 'New comment from: Jesus'
 *
 * From: https://stackoverflow.com/a/41118285/728287
 */
function interpolate(tpl: string, args: any) {
  return tpl.replace(/\${(\w+)}/g, (_, v) => args[v]);
}
