//@flow

import Order, { OrderDoc } from '../models/order.model';
import Product from '../models/product.model';

import config from './config';

agenda.cancel({ name: 'escrowManager' }, (err, numRemoved) => {
  if (err) return console.error(err);
  console.log('escrowManager cleaned up jobs: ', numRemoved);

  createEscrowManager();
});

agenda.define('checkout', async (job, done) => {
  //
  const previousDate = new Date(
    Date.now() - config.settings.holdProductFor * 1000
  );
  const orders: Array<OrderDoc> = await Order.find({
    status: 'pending',
    datePending: { $lte: previousDate },
  });
  console.log('Number of orders to cancel', orders.length);
  const productsToPutBackForSale = orders.map(order => order.product);
  console.log('productsToPutBackForSale: ', productsToPutBackForSale);
  await Product.updateMany(
    { _id: { $in: productsToPutBackForSale } },
    { status: 'forsale', $unset: { reservedDate: '' } }
  );
  done();
  // Product.find({ status: 'reserved', reservedDate: { $lte: previousDate } });
});

function createEscrowManager() {
  const job = agenda.create('checkout');
  job.unique({ jobName: 'checkout' });
  job.repeatEvery('1 minute');
  job.save();
}
