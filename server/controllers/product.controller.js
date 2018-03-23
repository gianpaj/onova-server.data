// @flow

import shortid from 'shortid';
import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import photos from '../helpers/photos';
import Product, { ProductDoc } from '../models/product.model';
import Tag, { TagDoc } from '../models/tag.model';
import User, { UserDoc } from '../models/user.model';
import config from '../config/config';

declare class session$Request extends express$Request {
  files: Array<any>;
  user: UserDoc;
  product: ProductDoc;
}

/**
 * Load a product and append to req.
 */
function load(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction,
  uuid: string
) {
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
 * Load a product with comments (and it's user doc) and append to req.
 */
function loadWithComments(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction,
  uuid: string
) {
  Product.findOne({ uuid })
    .populate({
      path: 'seller',
      select: 'username accountStatus',
    })
    .populate({
      path: 'comments.user',
      select: 'username accountStatus displayName profilePic',
    })
    .then((product: ProductDoc) => {
      if (!product) {
        throw new Error('');
      }
      req.product = product;
      return next();
    })
    .catch(() => {
      const e = new APIError('Invalid product', httpStatus.BAD_REQUEST);
      next(e);
    });
}

/**
 * Get a product
 *
 * GET /api/products/:uuid
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express session parameters
 * @property {string} req.params.uuid The unique id (shortid) of product.
 */
function get(req: session$Request, res: express$Response) {
  return res.json({ data: req.product });
}

/**
 * Create a new product
 *
 * POST /api/products
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {Array<number>} req.body.categoryIds
 * @property {string=} [req.body.currency='UAH']
 * @property {string} req.body.description
 * @property {string} req.body.price
 * @property {MongoId} req.body.seller
 * @property {Array<string>=} req.body.tags
 * @property {Array<number>} req.body.typeIds
 */
function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const product = new Product({
    categoryIds: req.body.categoryIds,
    // currency: req.body.currency,
    description: req.body.description,
    price: req.body.price,
    // status: req.body.status, // 'forsale' by default
    tags: req.body.tags,
    typeIds: req.body.typeIds,
    uuid: shortid.generate(), // needed here for photos' filenames
  });

  // create Tag documents
  if (req.body.tags) createTags(req.body.tags);

  // req.files is array of `photos` files
  if (req.files.length < 1) {
    const APIerr = new APIError('Product image(s) are required', 400);
    return next(APIerr);
  }

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

      // for (let i = 0; i < req.files.length; i++) {
      //   product.photoURIs.push('UPLOADING_PIC');
      // }

      photos.uploadProductImages(product, req.files);

      return product
        .save()
        .then(savedProduct => savedProduct)
        .catch(() => {
          throw new APIError('Error creating Product', 500);
        });
    })
    .then(savedProduct => {
      return res.status(201).json({ data: savedProduct });
    })
    .catch(e => next(e));
}

/**
 * Get a list of products that are for sale and which photos have been uploaded
 *
 * GET /api/products
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {number} req.query.skip Number of products to be skipped.
 * @property {number} req.query.limit Limit number of products to be returned.
 * @property {string} req.query.userid
 * @property {array<string>|string} req.query.tags
 */
function list(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, skip = 0, tags, userid } = req.query;
  let query = {
    status: 'forsale',
  };

  if (config.env !== 'test') {
    query = { ...query, photoURIs: { $exists: true, $not: { $size: 0 } } };
  }

  if (userid) {
    query = { ...query, seller: userid };
  }

  if (tags) {
    query = { ...query, tags: { $in: tags } };
  }

  const projection = { comments: 0 };

  // use static method from ProductSchema
  // flow-disable-next-line
  Product.list({ query, projection, limit, skip })
    .then(products => res.json({ data: products }))
    .catch(e => next(e));
}

/**
 * Remove a product - marking the 'status' as 'deleted'
 *
 * DELETE /api/products/:uuid
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {string} req.query.uuid
 */
function remove(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  var uuid = req.params.uuid;

  if (req.product.status !== 'forsale') {
    // item could be already sold or deleted, etc.
    throw new APIError('Product not found', 400);
  }

  // TODO: delete images from GSC
  // for (let i = 0; i < req.product.photoURIs.length; i++) {
  //   if (config.env === 'test') break;

  //   const file = req.product.photoURIs[i];
  //   bucket
  //     .file(file)
  //     .delete()
  //     .then(() => {
  //       debug(`gs://${CLOUD_BUCKET}/${file} deleted.`);
  //     })
  //     .catch(err => {
  //       debug('ERROR:', err);
  //     });
  // }

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
 * PUT /api/products/:uuid
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {string} req.query.uuid
 */
function update(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  Product.findOne({ uuid: req.params.uuid })
    .then(foundProduct => {
      if (!foundProduct) {
        throw new APIError('Product not found', 400);
      }

      // create Tag documents
      if (req.body.tags) createTags(req.body.tags);

      // for the moment image cannot be updated
      // if (req.files) {
      // }

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
      foundProduct.price = req.body.price
        ? mongoose.Types.Decimal128.fromString(req.body.price)
        : foundProduct.price;

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

function createTags(tags: Array<TagDoc>) {
  tags.forEach(tag => {
    Tag.findOneAndUpdate({ _id: tag }, { _id: tag }, { upsert: true }).catch(
      err => {
        if (err.codeName !== 'DuplicateKey') {
          console.log('error saving tags', err);
        }
      }
    );
  });
}

export default {
  load,
  loadWithComments,
  get,
  create,
  update,
  list,
  remove,
};
