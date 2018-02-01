// @flow

import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';

const Schema = mongoose.Schema;

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
    datePending: {
      type: Date,
      required: true,
      default: Date.now,
    },
    datePurchased: {
      type: Date,
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
      enum: ['paypal', 'liqpay'],
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
      enum: ['pending', 'purchased', 'shipped', 'completed', 'cancelled'],
    },
    taxAmount: String,
    transationFee: Schema.Types.Decimal128,
    transationId: String,
    transationStatus: {
      type: String,
      default: 'pl-pending',
      enum: ['pl-pending', 'pl-completed', 'pl-cancelled', 'pl-'],
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
  datePending: Date;
  datePurchased: ?Date;
  dateShipped: ?Date;
  onovaFee: number;
  paymentMethod: ?string;
  priceOfItem: number;
  product: MongoId;
  seller: MongoId;
  status: string;
  taxAmount: ?number;
  transationFee: ?number;
  transationId: ?string;
  transationStatus: ?string;
  // shippingFee: number;
  // shippingMethod: string;
  // shippingStatus: string;
  // shippingTax: number;
}

OrderSchema.loadClass(OrderDoc);

/**
 * Statics
 */
OrderSchema.statics = {
  /**
   * Get order
   *
   * @param {MongoId} id - The unique id (shortid) of order.
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
   * List orders in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of orders to be skipped.
   * @param {number} limit - Limit number of orders to be returned.
   * @returns {Promise<OrderDoc[]>}
   */
  list({ query = {}, skip = 0, limit = 50 } = {}): Promise<OrderDoc[]> {
    return this.find(query)
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

// Never return '__v' fields in the JSON representation
// Note that this doesn't effect `toObject`
OrderSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    ret.onovaFee = ret.onovaFee.$numberDecimal;
    ret.priceOfItem = ret.priceOfItem.$numberDecimal;
    // ret.taxAmount = ret.taxAmount.$numberDecimal;
    // ret.transationFee = ret.transationFee.$numberDecimal;
    delete ret.id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

OrderSchema.index({ product: 1 });
OrderSchema.index({ seller: 1 });
OrderSchema.index({ buyer: 1 });

export default mongoose.model('Order', OrderSchema);
