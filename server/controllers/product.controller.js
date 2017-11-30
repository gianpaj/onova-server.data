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

  User.findById(req.body.seller)
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
      product.seller = seller._id;

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
  Product.findOneAndUpdate(
    { uuid: uuid, status: 'forsale' },
    { status: 'deleted' }
  )
    .then(product => {
      if (!product) {
        throw new APIError('Product not found', 400);
      }

      // TODO: delete images from GSC

      return res.status(204).json();
    })
    .catch(() => {
      const e = new APIError('Error deleting Product', 400);
      next(e);
    });
}

const lol = {
  /**
   * ProductController.update()
   */
  update: function(req, res) {
    var id = req.params.id;
    Product.findOne({ _id: id }, function(err, Product) {
      if (err) {
        return res.status(500).json({
          message: 'Error when getting Product',
          error: err,
        });
      }
      if (!Product) {
        return res.status(404).json({
          error: { message: 'No such Product' },
        });
      }

      Product.photoURIs = req.body.photoURIs
        ? req.body.photoURIs
        : Product.photoURIs;
      Product.categoryIds = req.body.categoryIds
        ? req.body.categoryIds
        : Product.categoryIds;
      Product.typeIds = req.body.typeIds ? req.body.typeIds : Product.typeIds;
      Product.tags = req.body.tags ? req.body.tags : Product.tags;
      Product.description = req.body.description
        ? req.body.description
        : Product.description;
      Product.seller = req.body.seller ? req.body.seller : Product.seller;
      Product.status = req.body.status ? req.body.status : Product.status;
      Product.price = req.body.price ? req.body.price : Product.price;

      Product.save(function(err, Product) {
        if (err) {
          return res.status(500).json({
            message: 'Error when updating Product.',
            error: err,
          });
        }

        return res.json(Product);
      });
    });
  },
};

export default {
  load,
  get,
  create,
  // update,
  list,
  remove,
};
