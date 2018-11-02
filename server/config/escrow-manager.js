//@flow

import Order, { OrderDoc } from '../models/order.model';
import Product from '../models/product.model';

import config from './config';

import { agenda } from './express';

// const debug = require('debug')('server-data:escrow');
const debug = console.log;

export default class EscrowManager {
  constructor() {
    this.init();
  }

  init() {
    this.defineCheckoutJob();
    agenda.on('ready', () => {
      agenda.cancel({ name: 'checkout' }, (err, numRemoved) => {
        if (err) return console.error(err);
        debug('escrowManager cleaned up jobs:', numRemoved);
        agenda.start();
        this.createEscrowManager();
      });
    });
  }

  createEscrowManager() {
    const job = agenda.create('checkout');
    job.unique({ jobName: 'checkout' });
    job.repeatEvery(
      config.env === 'test'
        ? '3 seconds'
        : config.settings.holdProductFor + ' minutes'
    );
    job.save();
  }

  defineCheckoutJob() {
    agenda.define('checkout', async (job, done) => {
      console.log('checkout job running at', new Date());

      const previousDate = new Date(
        Date.now() -
          (config.env === 'test' ? 3 : config.settings.holdProductFor * 1000)
      );
      const query = {
        status: 'pending',
        // this also matches orders without transactionStatus key (pending orders that haven't been paid)
        transactionStatus: { $nin: ['ua-finished', 'ua-rejected'] },
        datePending: { $lte: previousDate },
      };
      const orders: Array<OrderDoc> = await Order.find(query);
      if (!orders.length) return done();

      const ordersUpdated: Array<OrderDoc> = await Order.updateMany(query, {
        $set: { status: 'cancelled', dateCancelled: new Date() },
      });

      debug('Unpaid orders cancelled:', ordersUpdated.nModified);
      const productsToPutBackForSale = orders
        .map(order => order.product)
        .filter(p => p);
      debug('productsToPutBackForSale:', productsToPutBackForSale);
      const updated = await Product.updateMany(
        { _id: { $in: productsToPutBackForSale } },
        { status: 'forsale', $unset: { reservedDate: '' } }
      );
      debug('Products updated: ', updated.nModified);
      done();
    });
  }
}
