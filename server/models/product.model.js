// @flow

import Promise from 'bluebird';
import mongoose from 'mongoose';
import httpStatus from 'http-status';
import shortid from 'shortid';

import APIError from '../helpers/APIError';

const Schema = mongoose.Schema;

var ProductSchema = new Schema(
  {
    categoryIds: {
      type: [Number],
      required: true,
    },
    comments: {
      type: [Schema.Types.ObjectId],
      ref: 'Comment',
    },
    currency: {
      type: String,
      required: true,
      default: 'UAH',
    },
    description: {
      type: String,
      required: true,
    },
    likes: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
    },
    photoURIs: {
      type: [String],
      // required: true, // added async after the images are uploaded to GSC
    },
    price: {
      type: Schema.Types.Decimal128,
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
      default: 'forsale',
      enum: ['forsale', 'reserved', 'sold', 'banned', 'deleted'],
    },
    tags: {
      type: [String],
      ref: 'Tag',
      // max number of 30 tags per product (see param-validation.js)
    },
    typeIds: {
      type: [Number],
      required: true,
    },
    uuid: {
      type: String,
      unique: true, // Unique index
    },
    // soldAt: Date,
  },
  {
    // assigns 'createdAt' and 'updatedAt' fields to your schema
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export class ProductDoc /*:: extends Mongoose$Document */ {
  categoryIds: Array<Number>;
  comments: Array<MongoId>;
  currency: string;
  description: string;
  likes: Array<MongoId>;
  photoURIs: Array<string>;
  price: number;
  seller: string;
  status: string;
  tags: Array<string>;
  typeIds: Array<Number>;
  uuid: string;
}

ProductSchema.loadClass(ProductDoc);

/**
 * Statics
 */
ProductSchema.statics = {
  /**
   * Get product
   *
   * @param {String} uuid - The unique id (shortid) of product.
   * @returns {Promise<Product, APIError>}
   */
  get(uuid): Promise<APIError> {
    return this.findOne({ uuid: uuid })
      .populate({
        path: 'seller',
        select: 'username accountStatus',
      })
      .then(product => {
        if (!product) {
          return Promise.reject();
        }
        return product;
      })
      .catch(() => {
        const err = new APIError('Invalid product', httpStatus.BAD_REQUEST);
        return Promise.reject(err);
      });
  },

  /**
   * List products in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of products to be skipped.
   * @param {number} limit - Limit number of products to be returned.
   * @returns {Promise<ProductDoc[]>}
   */
  list({ query = {}, skip = 0, limit = 50 } = {}): Promise<ProductDoc[]> {
    return this.find(query)
      .sort({ createdAt: -1 })
      .skip(+skip)
      .limit(+limit)
      .then((products: ProductDoc[]) => {
        if (!products) {
          return Promise.reject();
        }
        return products;
      })
      .catch(() => {
        const err = new APIError('Invalid products', httpStatus.BAD_REQUEST);
        return Promise.reject(err);
      });
  },
};

ProductSchema.pre('save', function(next) {
  if (!this.uuid) this.uuid = shortid.generate();
  next();
});

// Never return '__v' fields in the JSON representation
// Note that this doesn't effect `toObject`
ProductSchema.set('toJSON', {
  getters: true,
  transform: (doc, ret) => {
    ret.price = ret.price.$numberDecimal;
    delete ret.id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

ProductSchema.index({ status: 1, createdAt: 1 });
// ProductSchema.index({ status: 1, categoryIds: 1 });
ProductSchema.index({ status: 1, tags: 1 });
ProductSchema.index({ status: 1, photoURIs: 1 });
ProductSchema.index({ status: 1, seller: 1 });
// ProductSchema.index({ uuid: 1 }, { unique: true }); // created by `unique` schema setting above

/**
 * @typedef Product
 */
export default mongoose.model('Product', ProductSchema);
