// @flow

import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';

const Schema = mongoose.Schema;

/** @namespace */
var OrderSchema = new Schema(
  {
    archivedByBuyer: Boolean,
    archivedBySeller: Boolean,
    buyer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    dateDelivered: {
      type: Date,
    },
    datePending: {
      type: Date,
      required: true,
      default: Date.now,
    },
    datePaid: {
      type: Date,
    },
    dateConfirmed: {
      type: Date,
    },
    dateShipped: {
      type: Date,
    },
    dateReadyforShipment: {
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

        // NOT ACTIVE - Seller confirmed and awaits buyer to pay – Product status is now 'reserved'. All other orders for the same item are cancelled. (Do need to send a reason, now?)
        // 'onhold',

        'paid',

        // # 1 Step in UI - Product is ready for shipment. Tracking number is generated automatically
        'confirmed',

        // [Only by Shipping Provider] (i.e. NovaPohsta) - # 2 Step in UI
        'shipped',

        // Seller cancels order. Requires reason.
        // or
        // Buyer cancels order.
        'cancelled',

        // [Only by Shipping Provider] - # 3 Step in UI
        'delivered',

        // [Only by Shipping Provider]. Item has been collected - # 4 Step in UI
        'completed',

        // Buyer fails to collect, refuses the item (not as described), or fails to pay [by Payment or Shipping Provider]
        'failed_by_buyer',

        // Seller fails to ship or fails to confirm [by Payment or Shipping Provider]
        'failed_by_seller',

        // TODO: the holdProductFor or orderPendingFor windows expired without a response
        // [by Internal Process]
        'failed',
      ],
    },
    reason: {
      type: String,
    },
    taxAmount: String,
    trackingNumber: String,
    transactionFee: Schema.Types.Decimal128,
    transactionId: String,
    transactionStatus: {
      type: String,
      default: 'pl-pending',
      enum: [
        'pl-pending',
        'pl-completed',
        'pl-cancelled',
        'pl-refunded',
        'pl-failed',
      ],
    },
    shippingProvider: {
      type: String,
      enum: ['novaposhta'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export class OrderDoc /*:: extends Mongoose$Document */ {
  _id: MongoId;
  archivedByBuyer: boolean;
  archivedBySeller: boolean;
  buyer: MongoId;
  currency: string;
  dateCancelled: ?Date;
  dateCompleted: ?Date;
  dateDelivered: ?Date;
  datePending: Date;
  datePaid: ?Date;
  dateShipped: ?Date;
  dateReadyforShipment: ?Date;
  onovaFee: number;
  paymentMethod: ?string;
  priceOfItem: number;
  product: MongoId;
  seller: MongoId;
  status: string;
  taxAmount: ?number;
  trackingNumber: ?string;
  transactionFee: ?number;
  transactionId: ?string;
  transactionStatus: ?string;
  // shippingFee: number;
  // shippingMethod: string;
  shippingProvider: string;
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
  get(id: string): Promise<APIError> {
    return this.findById(id)
      .populate({
        path: 'buyer',
        select: 'accountStatus profilePic username',
      })
      .populate({
        path: 'seller',
        select: 'accountStatus profilePic username',
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
  list({ myid, skip = 0, limit = 50 }): Promise<OrderDoc[]> {
    return this.find({
      $or: [{ buyer: myid }, { seller: myid }],
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'seller',
        select: 'accountStatus profilePic username',
      })
      .populate({
        path: 'buyer',
        select: 'accountStatus profilePic username',
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
    const APIerr = new APIError('Duplicate order', httpStatus.BAD_REQUEST);
    return next(APIerr);
  }
  next(error);
});

function transform(doc, ret) {
  ret.onovaFee = ret.onovaFee.toString();
  ret.priceOfItem = ret.priceOfItem.toString();
  // ret.taxAmount = ret.taxAmount.toString();
  // ret.transactionFee = ret.transactionFee.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}

// Never return '__v' or '_id', fields
OrderSchema.set('toObject', {
  getters: true,
  transform,
});

OrderSchema.set('toJSON', {
  getters: true,
  transform,
});

OrderSchema.index({ product: 1, buyer: 1 }, { unique: true });
OrderSchema.index({ seller: 1 });
OrderSchema.index({ buyer: 1 });

export default mongoose.model('Order', OrderSchema);
