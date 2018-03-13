// @flow

import User, { UserDoc } from '../models/user.model';
import Product, { ProductDoc } from '../models/product.model';
import { agenda } from '../config/express';
import config from '../config/config';
import shortid from 'shortid';
import type { notifPayload } from '../controllers/notification.controller';

export function sendPush({
  data,
  targetUser,
  triggeredBy,
  triggeredType,
  message,
}: notifPayload): Promise<null> {
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
          message,
          platform: target.platform,
          productUuid,
          pushToken: target.pushToken,
          senderId: sender._id,
          senderName: sender.displayName || sender.username,
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
      });
  } else if (triggeredType == 'Product') {
    // comment notification to seller
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
      });
  }
}
