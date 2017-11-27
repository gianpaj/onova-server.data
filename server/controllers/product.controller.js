// @flow
import APIError from '../helpers/APIError';
import type { $Request, NextFunction } from 'express';

import Product from '../models/product.model';
import User from '../models/user.model';

/**
 * Load user and append to req.
 */
function load(req: $Request, res: $Response, next: NextFunction, id: string) {
  // use static method from ProductSchema
  Product.get(id)
    .then(user => {
      req.user = user;
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
 * @property {string} req.body.photoURIs // array of strings?
 * @property {string} req.body.categoryIds // array of strings?
 * @property {string} req.body.typeIds // array of strings?
 * @property {string} req.body.tags - (optional)
 * @property {string} req.body.description
 * @property {string} req.body.seller
 * @property {string} req.body.price
 * @property {string} req.body.currency - (optional) 'UAH' by default
 */
function create(req: $Request, res: $Response, next: NextFunction) {
  const doc: Object = {
    categoryIds: req.body.categoryIds,
    typeIds: req.body.typeIds,
    // tags: req.body.tags, //optional
    description: req.body.description,
    seller: req.body.seller,
    price: req.body.price,
    // currency: req.body.currency, // 'UAH' by default
    // status: req.body.status, // 'forsale' by default
  };

  // req.files is array of `photos` files
  if (req.files.length < 1) {
    const APIerr = new APIError('Product image(s) are required', 400, true);
    return next(APIerr);
  }

  console.log(req.files);
  console.log(req.body);

  if (req.body.tags) {
    doc.tags = req.body.tags;
  }

  User.findById(doc.seller)
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
    })
    .then(() => {
      res.status(201).json({ ok: true });
    })
    .catch(err => {
      return next(err);
    });

  // const product = new Product(doc);

  // product
  //   .save()
  //   .then(savedProduct => {
  //     // if (err) {
  //     //   return res.status(500).json({
  //     //     message: 'Error when creating Product',
  //     //     error: err,
  //     //   });
  //     // }
  //     return res.status(201).json(savedProduct);
  //   })
  //   .catch(e => next(e));
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
          message: 'No such Product',
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

export default {
  load,
  get,
  create,
  // update,
  // list,
  // remove,
};
