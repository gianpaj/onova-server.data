// @flow

import httpStatus from 'http-status';
import type { $Request, NextFunction } from 'express';

import APIError from '../helpers/APIError';
import Product, { ProductDoc } from '../models/product.model';
import Tag from '../models/tag.model';
import User from '../models/user.model';

/**
 * Load a product and append to req.
 */
function load(req: $Request, res: $Response, next: NextFunction, uuid: string) {
  // use static method from ProductSchema
  // flow-disable-next-line
  Product.get(uuid)
    .then((product: ProductDoc) => {
      req.product = product;
      return next();
    })
    .catch(e => next(e));
}

/**
 * GET /api/products/:uuid - Get product
 *
 * @property {string} req.params.uuid  - The unique id (shortid) of product.
 */
function get(req: $Request, res: $Response) {
  return res.json({ data: req.product });
}

/**
 * Create new product
 *
 * POST /api/products
 *
 * @property {Array<number>} req.body.categoryIds
 * @property {string} req.body.currency - (optional) 'UAH' by default
 * @property {string} req.body.description
 * @property {string} req.body.price
 * @property {MongoId} req.body.seller
 * @property {string} req.body.tags - (optional)
 * @property {Array<number>} req.body.typeIds
 */
function create(req: $Request, res: $Response, next: NextFunction) {
  const product = new Product({
    categoryIds: req.body.categoryIds,
    // currency: req.body.currency, // 'UAH' by default
    description: req.body.description,
    price: req.body.price,
    // status: req.body.status, // 'forsale' by default
    tags: req.body.tags, // optional field
    typeIds: req.body.typeIds,
  });

  // create Tag documents
  if (req.body.tags) {
    req.body.tags.forEach(tag => {
      Tag.findOneAndUpdate({ _id: tag }, { _id: tag }, { upsert: true })
        .then(() => {})
        .catch(err => {
          console.log('error saving tags', err);
        });
    });
  }

  // req.files is array of `photos` files
  if (req.files.length < 1) {
    const APIerr = new APIError('Product image(s) are required', 400);
    return next(APIerr);
  }

  // console.log(req.files);
  // TODO: upload images
  product.photoURIs = ['a', 'b'];

  User.findById(req.user._id)
    .then(seller => {
      if (!seller) {
        throw new APIError('Seller not found', 400);
      }
      if (seller.accountStatus !== 'verified') {
        throw new APIError(
          'Please verify your account before creating a listing',
          400
        );
      }
      product.seller = req.user._id;

      return product
        .save()
        .then(savedProduct => savedProduct)
        .catch(() => {
          throw new APIError('Error creating Product', 400);
        });
    })
    .then(savedProduct => {
      return res.status(201).json({ data: savedProduct });
    })
    .catch(e => next(e));
}

/**
 * Get list of products.
 *
 * GET /api/products
 *
 * @property {number} req.query.skip - Number of products to be skipped.
 * @property {number} req.query.limit - Limit number of products to be returned.
 * @property {array<string>|string} req.query.tags
 */
function list(req: $Request, res: $Response, next: NextFunction) {
  const { limit = 50, skip = 0, tags } = req.query;
  let query = { status: 'forsale' };

  if (tags) {
    query = { ...query, tags: { $in: tags } };
  }

  // use static method from ProductSchema
  // flow-disable-next-line
  Product.list({ query, limit, skip })
    .then(products => res.json({ data: products }))
    .catch(e => next(e));
}

/**
 * Remove a product - marking the 'status' as 'deleted'
 *
 * GET /api/products/:uuid
 *
 * @property {string} req.query.uuid
 */
function remove(req: $Request, res: $Response, next: NextFunction) {
  var uuid = req.params.uuid;

  if (req.product.status !== 'forsale') {
    // item could be already sold or deleted, etc.
    throw new APIError('Product not found', 400);
  }

  // TODO: delete images from GSC

  Product.findOneAndUpdate(
    { uuid: uuid, status: 'forsale' },
    { status: 'deleted' }
  )
    .then(() => res.status(204).json())
    .catch(() => {
      const err = new APIError('Error deleting Product', 500);
      next(err);
    });
}

/**
 * Update a product
 *
 * GET /api/products/:uuid
 *
 * @property {string} req.query.uuid
 */
function update(req: $Request, res: $Response, next: NextFunction) {
  const uuid = req.params.uuid;
  Product.findOne({ uuid: uuid })
    .then(foundProduct => {
      if (!foundProduct) {
        throw new APIError('Product not found', 400);
      }

      // create Tag documents
      if (req.body.tags) {
        req.body.tags.forEach(tag => {
          Tag.findOneAndUpdate({ _id: tag }, { _id: tag }, { upsert: true })
            .then(() => {})
            .catch(err => {
              console.log('error saving tags', err);
            });
        });
      }

      // foundProduct.photoURIs = req.body.photoURIs
      //   ? req.body.photoURIs
      //   : foundProduct.photoURIs;
      foundProduct.categoryIds = req.body.categoryIds
        ? req.body.categoryIds
        : foundProduct.categoryIds;
      foundProduct.typeIds = req.body.typeIds
        ? req.body.typeIds
        : foundProduct.typeIds;
      foundProduct.tags = req.body.tags ? req.body.tags : foundProduct.tags;
      foundProduct.description = req.body.description
        ? req.body.description
        : foundProduct.description;
      // foundProduct.status = req.body.status
      //   ? req.body.status
      //   : foundProduct.status;
      foundProduct.price = req.body.price ? req.body.price : foundProduct.price;

      return foundProduct.save().then(product => {
        return res.json({ data: product });
      });
    })
    .catch(err => {
      if (!err instanceof APIError) {
        err = new APIError('Error updating Product', 500);
      }
      next(err);
    });
}

export default {
  load,
  get,
  create,
  update,
  list,
  remove,
};
