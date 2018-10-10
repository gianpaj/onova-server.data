// @flow

import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import Block from '../models/block.model';
import { userPopulateFields } from './user.model';

const { Schema } = mongoose;

/** @namespace */
var OrderSchema = new Schema({
  archivedByBuyer: Boolean,
  archivedBySeller: Boolean,
  buyer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  citySender: String,
  cityRecipient: String,
  currency: {
    type: String,
    required: true,
    default: 'UAH',
  },
  dateCancelled: {
    type: Date,
  },
  dateCompleted: {
    type: Date,
  },
  dateConfirmed: {
    type: Date,
  },
  dateDelivered: {
    type: Date,
  },
  datePaid: {
    type: Date,
  },
  datePending: {
    type: Date,
    required: true,
    default: Date.now,
  },
  dateShipped: {
    type: Date,
  },
  onovaFee: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['paypal', 'uapay'],
  },
  priceOfItem: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  reason: {
    type: String,
  },
  reviewFromBuyer: {
    type: Schema.Types.ObjectId,
    ref: 'Review',
  },
  reviewFromSeller: {
    type: Schema.Types.ObjectId,
    ref: 'Review',
  },
  seller: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: [
      // Unpaid - Customer started the checkout process. Payment is not completed.
      'pending',

      // Buyer pays and waiting for seller to confirm – Product status is now 'reserved'
      'paid',

      // Product is ready for shipment. Tracking number is generated automatically
      'confirmed',

      // [Only by Shipping Provider] (i.e. NovaPohsta)
      'shipped',

      // Seller cancels order (doesn't confirm). Requires reason.
      // or
      // Buyer cancels order (or doesn't pay in 15 mins). Reason if internal process (payment denied/timeout)
      'cancelled',

      // [Only by Shipping Provider]
      'delivered',

      // [Only by Shipping Provider]. Item has been collected
      'completed',

      // Buyer fails to collect or refuses the item (not as described)
      'failed_by_buyer',

      // Seller fails to ship
      'failed_by_seller',

      // TODO: the holdProductFor or orderPendingFor windows expired without a response
      // [by Internal Process]
      'failed',
    ],
  },
  taxAmount: String,
  trackingNumber: String,
  transactionFee: Schema.Types.Decimal128,
  transactionId: String,
  transactionStatus: {
    type: String,
    default: 'ua-pending',
    enum: [
      'ua-pending',
      'ua-needsconfirmation',
      'ua-finished',
      'ua-rejected',
      'ua-reversed',
    ],
  },
  shippingFee: Schema.Types.Decimal128,
  shippingProvider: {
    type: String,
    enum: ['novaposhta'],
  },
});

OrderSchema.virtual('total').get(function() {
  return this.transactionFee + this.priceOfItem + this.shippingFee;
});

export class OrderDoc /*:: extends Mongoose$Document */ {
  _id: MongoId;
  archivedByBuyer: boolean;
  archivedBySeller: boolean;
  buyer: MongoId;
  citySender: string;
  cityRecipient: string;
  currency: string;
  dateCancelled: ?Date;
  dateCompleted: ?Date;
  dateConfirmed: ?Date;
  dateDelivered: ?Date;
  datePaid: ?Date;
  datePending: Date;
  dateShipped: ?Date;
  onovaFee: number;
  paymentMethod: ?string;
  priceOfItem: number;
  product: MongoId;
  reason: ?string;
  reviewFromBuyer: MongoId;
  reviewFromSeller: MongoId;
  seller: MongoId;
  status: string;
  taxAmount: ?number;
  trackingNumber: ?string;
  transactionFee: number;
  transactionId: ?string;
  transactionStatus: ?string;
  shippingFee: ?number;
  // shippingMethod: string;
  shippingProvider: ?string;
  // shippingStatus: string;
  // shippingTax: number;
}

OrderSchema.loadClass(OrderDoc);

/**
 * Statics
 *
 * @memberof OrderSchema
 */
OrderSchema.statics = {
  /**
   * Get order
   *
   * @param {MongoId} id The unique id (shortid) of order.
   * @returns {Promise<Order, APIError>}
   */
  get(id: string, myid?: string): Promise<APIError> {
    let query = { _id: id };
    if (myid) query['$or'] = [{ buyer: myid }, { seller: myid }];
    return this.findOne(query)
      .populate({
        path: 'buyer',
        select: userPopulateFields,
      })
      .populate({
        path: 'seller',
        select: userPopulateFields,
      })
      .populate({
        path: 'product',
        select: '`currency photoURIs price status uuid`',
      })
      .then((order: OrderDoc) => {
        if (!order) {
          return Promise.reject();
        }
        return order;
      })
      .catch(() => {
        const err = new APIError('Invalid order', httpStatus.BAD_REQUEST);
        return Promise.reject(err);
      });
  },

  /**
   * List orders (as seller and buyer) in descending order of 'createdAt' timestamp.
   *
   * @param {Object} query Query params
   * @param {MongoId} query.myid User's _id
   * @param {number} query.skip Number of orders to be skipped.
   * @param {number} query.limit Limit number of orders to be returned.
   * @returns {Promise<OrderDoc[]>}
   */
  async list({ myid, skip = 0, limit = 50 }): Promise<OrderDoc[]> {
    const usersIamBlockedBy = await Block.find({ targetUser: myid });

    const usersIamBlocking = await Block.find({ sourceUser: myid });

    const idsA = usersIamBlockedBy.map(u => u.sourceUser);
    const idsB = usersIamBlocking.map(u => u.targetUser);

    return this.find({
      $or: [{ buyer: myid }, { seller: myid }],
      buyer: { $nin: [...idsA, ...idsB] },
      seller: { $nin: [...idsA, ...idsB] },
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'seller',
        select: userPopulateFields,
      })
      .populate({
        path: 'buyer',
        select: userPopulateFields,
      })
      .populate({
        path: 'product',
        select: 'currency status price uuid photoURIs',
      })
      .skip(+skip)
      .limit(+limit)
      .then((orders: OrderDoc[]) => {
        if (!orders) {
          return Promise.reject();
        }
        return orders;
      })
      .catch(() => {
        const err = new APIError('Invalid orders', httpStatus.BAD_REQUEST);
        return Promise.reject(err);
      });
  },
};

OrderSchema.post('save', function(error: Error, doc, next) {
  if (error.code === 11000) {
    return next({ message: 'Duplicate order', order: doc });
  }
  next(error);
});

function transform(doc, ret) {
  ret.onovaFee = ret.onovaFee.toString();
  ret.priceOfItem = ret.priceOfItem.toString();
  // ret.taxAmount = ret.taxAmount.toString();
  if (doc.transactionFee) ret.transactionFee = ret.transactionFee.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}

OrderSchema.set('toObject', {
  getters: true,
  virtuals: true,
  transform,
});

OrderSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform,
});

OrderSchema.index({ product: 1, buyer: 1 }, { unique: true });
OrderSchema.index({ seller: 1 });
OrderSchema.index({ buyer: 1 });

export default mongoose.model('Order', OrderSchema);
