//@flow

import Order, { OrderDoc } from '../models/order.model';
import Product from '../models/product.model';

import config from './config';

import { agenda } from './express';

const debug = require('debug')('server-data:escrow');

export default class EscrowManager {
  constructor() {
    this.init();
  }

  init() {
    agenda.define('checkout', async (job, done) => {
      console.log('checkout job running at', new Date());
      //
      const previousDate = new Date(
        Date.now() - config.settings.holdProductFor * 1000
      );
      const orders: Array<OrderDoc> = await Order.find({
        status: 'pending',
        // this also matches orders without transactionStatus key (pending orders that haven't been paid)
        transactionStatus: { $nin: ['ua-finished', 'ua-rejected'] },
        datePending: { $lte: previousDate },
      });
      debug('Unpaid orders to cancel:', orders.length);
      const productsToPutBackForSale = orders.map(order => order.product);
      debug('productsToPutBackForSale:', productsToPutBackForSale);
      await Product.updateMany(
        { _id: { $in: productsToPutBackForSale } },
        { status: 'forsale', $unset: { reservedDate: '' } }
      );
      done();
      // Product.find({ status: 'reserved', reservedDate: { $lte: previousDate } });
    });

    agenda.on('ready', () => {
      // agenda.cancel({ name: 'escrowManager' }, (err, numRemoved) => {
      //   if (err) return console.error(err);
      //   debug('escrowManager cleaned up jobs: ', numRemoved);
      agenda.start();
      createEscrowManager();
      // });
    });

    function createEscrowManager() {
      const job = agenda.create('checkout');
      job.unique({ jobName: 'checkout' });
      job.repeatEvery('5 seconds');
      job.save();
    }
  }
}
