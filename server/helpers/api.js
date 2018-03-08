// @flow

import request from 'request-promise-native';
import User, { UserDoc } from '../models/user.model';

const hostname = 'localhost';

export function post(uri, port, json): Promise<null> {
  // return new Promise((resolve, reject) => {
  return request({
    method: 'POST',
    uri: `http://${hostname}:${port}/api/v1${uri}`,
    body: json,
    json: true,
  })
    .then(res => res)
    .catch(e => e);
}

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
    .then((sender: UserDoc) => {
      if (!sender) {
        throw new Error('Cannot find sender');
      }

      return User.findById(targetId)
        .then((target: UserDoc) => {
          if (!target) {
            throw new Error('Cannot find target');
          }
          return { sender, target };
        })
        .catch(e => e);
    })
    .then(({ sender, target }) => {
      return post('/push', 3030, {
        sender,
        target,
        productUuid,
        message,
      }).then(res => res);
    })
    .catch(e => {
      console.error(e);
    });
}
