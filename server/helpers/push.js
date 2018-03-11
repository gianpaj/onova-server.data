// @flow

import User, { UserDoc } from '../models/user.model';
import { agenda } from '../config/express';
import config from '../config/config';

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
        senderName: sender.displayName || sender.username,
        productUuid,
        pushToken: target.pushToken,
        message,
      };
      const job = agenda.now(config.JOBNAMES.PUSHCOMMENTS, pushData);

      return job.save(err => {
        if (err) throw new Error(`Job failed with error: ${err}`);
      });
    })
    .catch(e => {
      console.error(e);
    });
}
