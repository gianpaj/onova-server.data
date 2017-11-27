// @flow

import APIError from '../helpers/APIError';
import type { $Request, NextFunction } from 'express';

import Product from '../models/product.model';
import User from '../models/user.model';

/**
 * Load user and append to req.
 */
function load(req: $Request, res: $Response, next: NextFunction, uuid: string) {
  // use static method from ProductSchema
  // flow-disable-next-line
  Product.get(uuid)
    .then(product => {
      req.product = product;
      return next();
    })
    .catch(e => next(e));
}

/**
 * GET /api/products/:uuid - Get product
 */
function get(req: $Request, res: $Response) {
  const p = req.product;
  const doc = {
    uuid: p.uuid,
    photoURIs: p.photoURIs,
    categoryIds: p.categoryIds,
    typeIds: p.typeIds,
    // tags: p.tags, //populated?
    description: p.description,
    // seller: p.seller, //populated?
    // comments: p.comments, //populated?
    likesCount: p.likes.lenght,
    price: p.price,
    currency: p.currency,
    status: p.status,
    createdAt: p.createdAt,
  };
  return res.json(doc);
}

/**
 * Create new product
 *
 * POST /api/products
 *
 * @property {string} req.body.categoryIds
 * @property {string} req.body.currency - (optional) 'UAH' by default
 * @property {string} req.body.description
 * @property {string} req.body.price
 * @property {string} req.body.seller
 * @property {string} req.body.tags - (optional)
 * @property {string} req.body.typeIds
 */
function create(req: $Request, res: $Response, next: NextFunction) {
  const doc: Object = {
    categoryIds: req.body.categoryIds,
    // currency: req.body.currency, // 'UAH' by default
    description: req.body.description,
    price: req.body.price,
    // seller: req.body.seller, // need ref
    // status: req.body.status, // 'forsale' by default
    // tags: req.body.tags, // optional
    typeIds: req.body.typeIds,
  };

  // req.files is array of `photos` files
  if (req.files.length < 1) {
    const APIerr = new APIError('Product image(s) are required', 400, true);
    return next(APIerr);
  }

  // console.log(req.files);
  // console.log(req.body);

  // @todo create tag documents
  if (req.body.tags) {
    doc.tags = req.body.tags;
  }

  // @todo upload images
  doc.photoURIs = ['a', 'b'];

  User.findById(req.body.seller)
    .then(seller => {
      if (!seller) {
        throw new APIError('Seller not found', 400, true);
      }
      if (seller.accountStatus !== 'verified') {
        throw new APIError(
          'Please verify your account before creating a listing',
          400,
          true
        );
      }
      doc.seller = seller._id;

      const product = new Product(doc);

      return product
        .save()
        .then(savedProduct => savedProduct)
    .catch(err => {
          console.error(err);
          throw new APIError('Error creating Product', 400, true);
    });
    })
    .then(savedProduct => {
      return res.status(201).json({ data: _prepareProductJson(savedProduct) });
    })
    .catch(e => next(e));
}

const lol = {
  /**
   * ProductController.list()
   */
  list: function(req, res) {
    Product.find(function(err, Products) {
      if (err) {
        return res.status(500).json({
          message: 'Error when getting Product.',
          error: err,
        });
      }
      return res.json(Products);
    });
  },

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

  /**
   * ProductController.remove()
   */
  remove: function(req, res) {
    var id = req.params.id;
    Product.findByIdAndRemove(id, function(err, Product) {
      if (err) {
        return res.status(500).json({
          message: 'Error when deleting the Product.',
          error: err,
        });
      }
      return res.status(204).json();
    });
  },
};

/**
 * Limit number of fields send back for a product
 * (private)
 */
function _prepareProductJson(p: Object): Object {
  const json = {
    categoryIds: p.categoryIds,
    comments: p.comments,
    currency: p.currency,
    description: p.description,
    likes: p.likes,
    photoURIs: p.photoURIs,
    price: p.price,
    seller: p.seller,
    status: p.status,
    tags: p.tags,
    typeIds: p.typeIds,
    uuid: p.uuid,
  };
  return json;
}

export default {
  load,
  get,
  create,
  // update,
  // list,
  // remove,
};
