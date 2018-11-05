//@flow

import Order, { OrderDoc } from '../models/order.model';
import {
  createOrderNotification,
  rejectPayment,
} from '../controllers/order.controller';
import Product from '../models/product.model';

import config from './config';

import { agenda } from './express';

// const debug = require('debug')('server-data:escrow');
const debug = console.log;

export default class EscrowManager {
  constructor() {
    this.initCheckoutJob();
    this.initCancelPaidOrdersJob();
  }

  initCheckoutJob() {
    this.defineCheckoutJob();

    agenda.on('ready', () => {
      agenda.cancel({ name: 'checkout' }, (err, numRemoved) => {
        if (err) return console.error(err);
        debug('escrowManager cleaned up jobs:', numRemoved);
        agenda.start();
        this.createCheckoutJob();
      });
    });
  }

  initCancelPaidOrdersJob() {
    this.defineCancelPaidOrdersJob();

    agenda.on('ready', () => {
      agenda.cancel({ name: 'cancelPaidOrders' }, (err, numRemoved) => {
        if (err) return console.error(err);
        debug('escrowManager cleaned up jobs:', numRemoved);
        agenda.start();
        this.createCancelPaidOrdersJob();
      });
    });
  }

  createCheckoutJob() {
    const job = agenda.create('checkout');
    job.unique({ jobName: 'checkout' });
    job.repeatEvery(config.env === 'test' ? '3 seconds' : '30 seconds');
    job.save();
  }

  createCancelPaidOrdersJob() {
    const job = agenda.create('cancelPaidOrders');
    job.unique({ jobName: 'cancelPaidOrders' });
    job.repeatEvery(config.env === 'test' ? '3 seconds' : '60 minutes');
    job.save();
  }

  defineCheckoutJob() {
    agenda.define('checkout', async (job, done) => {
      console.log('checkout job running at', new Date());

      const previousDate = new Date(
        Date.now() -
          (config.env === 'test'
            ? 30 * 1000
            : config.settings.holdProductFor * 1000)
      );
      const query = {
        status: 'pending',
        // this also matches orders without transactionStatus key (pending orders that haven't been paid)
        transactionStatus: { $nin: ['ua-finished', 'ua-rejected'] },
        datePending: { $gte: previousDate },
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
      const updated = await this.removeProductsFromCheckout(
        productsToPutBackForSale
      );
      debug('Products updated: ', updated.nModified);
      done();
    });
  }

  defineCancelPaidOrdersJob() {
    agenda.define('cancelPaidOrders', async (job, done) => {
      console.log('cancelPaidOrders job running at', new Date());

      const previousDate = new Date(
        Date.now() -
          (config.env === 'test'
            ? 30 * 1000
            : config.settings.cancelPaidOrdersAfter * 1000)
      );

      try {
        const query = {
          status: 'paid',
          transactionStatus: 'ua-finished',
          datePaid: { $gte: previousDate },
        };
        const orders: Array<OrderDoc> = await Order.find(query);
        if (!orders.length) return done();

        const paymentsToReject = orders.map(rejectPayment);

        await Promise.all(paymentsToReject);

        debug(paymentsToReject.length, 'payment(s) rejected');

        const ordersUpdated: Array<OrderDoc> = await Order.updateMany(
          { ...query, transactionStatus: 'ua-reversed' },
          {
            $set: { status: 'failed_by_seller', dateFailed: new Date() },
          }
        );

        debug('Paid orders cancelled:', ordersUpdated.nModified);
        const productsToPutBackForSale = orders
          .map(order => order.product)
          .filter(p => p);
        debug('productsToPutBackForSale:', productsToPutBackForSale);
        const updated = await this.removeProductsFromCheckout(
          productsToPutBackForSale
        );
        debug('Products updated:', updated.nModified);

        const updatedOrders: Array<OrderDoc> = await Order.find({
          _id: { $in: orders.map(o => o._id) },
        });

        // notify buyer that order has been cancelled, because the seller didn't confirm
        // notify seller that they did not confirm or canceled the order on time

        // create array of arrays of notification promises and then flatten/merge the arrays
        const notificationPromises = [].concat.apply(
          [],
          updatedOrders.map(order => [
            createOrderNotification(order, true),
            createOrderNotification(order, false),
          ])
        );

        await Promise.all(notificationPromises);

        done();
      } catch (error) {
        console.error(error);
        done(error);
      }
    });
  }

  removeProductsFromCheckout(products): Promise<any> {
    return Product.updateMany(
      { _id: { $in: products } },
      { status: 'forsale', $unset: { reservedDate: '' } }
    );
  }
}
