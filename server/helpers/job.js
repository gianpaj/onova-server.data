// @flow
const debug = require('debug')('express-mongoose-es6-rest-api:index');

import { agenda } from '../config/express';
import { OrderDoc } from '../models/order.model';
import config from '../config/config';

export const i18n = {
  orderConfirmed:
    "Awesome! Here's the tracking number:\n__TRACKING_NUM__\nThe item can now be shipped from Nova Poshta",
  orderShipped: 'The package has been shipped! 🎉',
};

type SystemMessage = {};

export default class JobManager {
  static sendSystemMessage(order: OrderDoc) {
    return new Promise((resolve, reject) => {
      // send Tracking Number

      // if (order.status === 'confirmed')
      const message: SystemMessage = {
        order,
        message: i18n.orderConfirmed.replace(
          '__TRACKING_NUM__',
          order.trackingNumber
        ),
      };

      const job = agenda.create(config.JOBNAMES.SYSTEM_MSG, message);

      job.save(err => {
        if (err) {
          const error = new Error(`Job failed with error: ${err}`);
          reject(error);
        }
        debug(config.JOBNAMES.SYSTEM_MSG, 'Job successfully saved');
        resolve();
      });
    });
  }
}
