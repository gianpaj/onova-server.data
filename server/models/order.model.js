// @flow

import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';

const Schema = mongoose.Schema;

/** @namespace */
var OrderSchema = new Schema(
  {
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
    dateProcessing: {
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
        // Unpaid - Customer started the checkout process. Payment is not completed. Product marked as 'reserved'
        'pending',
        // NOT ACTIVE - Seller confirmed and awaits buyer to pay – Product status is now 'reserved'. All other orders for the same item are cancelled. (Do need to send a reason, now?)
        // 'onhold',
        // Payment successful. Product marked as 'sold' [Only by Payment Provider]
        'paid',
        // # 1 Step in UI - Product is ready for shipment. Tracking number is generated automatically
        'processing',
        // Only by Shipping Provider (i.e. NovaPohsta) - # 2 Step in UI
        'shipped',
        // Seller cancels order before confirming (requires reason)
        'cancelled',
        // Only by Shipping Provider - # 3 Step in UI
        'delivered',
        // Only by Shipping Provider. Item has been collected - # 4 Step in UI
        'completed',
        // Seller fails to ship or fails to confirm
        'failed_by_seller',
        // Buyer fails to collect or fails to pay
        'failed_by_buyer',
        // Payment failed or was declined (unpaid)
        // or
        // TODO: the holdProductFor or orderPendingFor windows expired without a response
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
        select: 'username accountStatus',
      })
      .populate({
        path: 'seller',
        select: 'username accountStatus',
      })
      .populate({
        path: 'product',
        select: 'currency status price uuid',
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

// Never return '__v' fields in the JSON representation
// Note that this doesn't effect `toObject`
OrderSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    ret.onovaFee = ret.onovaFee.toString();
    ret.priceOfItem = ret.priceOfItem.toString();
    // ret.taxAmount = ret.taxAmount.toString();
    // ret.transactionFee = ret.transactionFee.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

OrderSchema.index({ product: 1, buyer: 1 }, { unique: true });
OrderSchema.index({ seller: 1 });
OrderSchema.index({ buyer: 1 });

export default mongoose.model('Order', OrderSchema);
