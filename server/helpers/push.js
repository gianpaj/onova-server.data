// @flow

import User, { UserDoc } from '../models/user.model';
import { agenda } from '../config/express';
import config from '../config/config';
import shortid from 'shortid';

export function sendPush({
  senderId,
  targetId,
  productUuid,
  message,
}: {
  senderId: string,
  targetId: string,
  productUuid: string,
  message: string,
}): Promise<null> {
  return User.findById(senderId)
    .then(sender => {
      if (!sender) {
        throw new Error('Cannot find sender');
      }

      return User.findById(targetId)
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
        targetId: target._id,
        random: shortid(), // for unique push notification
      };
      const job = agenda.create(config.JOBNAMES.PUSHCOMMENTS, pushData);

      return job.save(err => {
        if (err) throw new Error(`Job failed with error: ${err}`);
      });
    })
    .catch(e => {
      console.error(e);
    });
}
