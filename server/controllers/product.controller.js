// @flow

import shortid from 'shortid';
import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import photos from '../helpers/photos';
import Block from '../models/block.model';
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
      select: 'username accountStatus profilePic',
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

  if (/\.\d{1}$/.test(product.price)) {
    product.price += '0';
  }

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

      if (config.env == 'test') {
        product.photoURIs = [
          'http://assets.onova.co/products/B11zDErJQ-1-1527232263107.jpg',
        ];
      } else {
        photos.uploadProductImages(product, req.files);
      }

      return product
        .save()
        .then(savedProduct => savedProduct)
        .catch(() => {
          throw new APIError(
            'Error creating Product',
            httpStatus.INTERNAL_SERVER_ERROR
          );
        });
    })
    .then(savedProduct => {
      return res.status(httpStatus.CREATED).json({ data: savedProduct });
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
 * @property {number} req.query.lastId
 * @property {number} req.query.limit Limit number of products to be returned.
 * @property {string} req.query.userid
 * @property {string} req.query.username
 * @property {array<string>|string} req.query.tags
 */
async function list(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, lastId, tags, userid, username } = req.query;
  const projection = { comments: 0 };
  let query = {
    status: 'forsale',
  };

  if (config.env !== 'test') {
    query = { ...query, photoURIs: { $exists: true, $not: { $size: 0 } } };
  }

  if (userid) {
    if (req.user) {
      const usersIamBlocking = await Block.find({
        sourceUser: req.user._id,
        targetUser: userid,
      });

      const idsB = usersIamBlocking.map(u => u.targetUser.toString());

      // limit by seller and exclude those blocked
      query = { ...query, seller: { $nin: idsB, $in: [userid] } };
    } else {
      query = { ...query, seller: userid };
    }
  }

  if (tags) {
    query = { ...query, tags: { $in: tags } };
  }

  // only search products by seller's username
  if (username) {
    return User.findOne({ username })
      .then(user => {
        if (!user) {
          const APIerr = new APIError('No seller found', 404);
          return next(APIerr);
        }

        return Product.list({ query: { seller: user._id }, projection })
          .then(products => res.json({ data: products }))
          .catch(e => next(e));
      })
      .catch(e => next(e));
  }

  // for pagination - results are excluding the lastId
  if (lastId) {
    query = { ...query, _id: { $gte: lastId } };

    return Product.findById(lastId).then(product => {
      if (!product) {
        throw new APIError('Product not found.', httpStatus.NOT_FOUND);
      }
      return Product.list({ query, projection, limit })
        .then(data => res.json({ data }))
        .catch(e => next(e));
    });
  } else {
    // use static method from ProductSchema
    Product.list({ query, projection, limit })
      .then(data => res.json({ data }))
      .catch(e => next(e));
  }
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
    throw new APIError('Product not found', httpStatus.BAD_REQUEST);
  }

  Product.findOneAndUpdate(
    { uuid: uuid, status: 'forsale' },
    { status: 'deleted' }
  )
    .then(() => res.status(httpStatus.NO_CONTENT).json())
    .catch(() => {
      const err = new APIError(
        'Error deleting Product',
        httpStatus.INTERNAL_SERVER_ERROR
      );
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
 * @property {*} req.body - Express body parameters
 * @property {Array<number>} req.body.categoryIds
 * @property {string} req.body.description
 * @property {string} req.body.price
 * @property {Array<string>=} req.body.tags
 * @property {Array<number>} req.body.typeIds
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

      if (foundProduct.status == 'sold') {
        throw new APIError('Cannot update a product that has been sold', 400);
      }

      // create Tag documents
      if (req.body.tags) createTags(req.body.tags);

      if (req.files) {
        Product.findOneAndUpdate(
          { _id: req.product._id },
          { $set: { photoURIs: [] } }
        ).then(() => photos.uploadProductImages(req.product, req.files));
      }

      foundProduct.categoryIds = req.body.categoryIds
        ? req.body.categoryIds
        : foundProduct.categoryIds;
      foundProduct.description = req.body.description
        ? req.body.description
        : foundProduct.description;

      if (/\.\d{1}$/.test(req.body.price)) {
        req.body.price += '0';
      }

      foundProduct.price = req.body.price
        ? mongoose.Types.Decimal128.fromString(req.body.price)
        : foundProduct.price;
      foundProduct.tags = req.body.tags ? req.body.tags : foundProduct.tags;
      foundProduct.typeIds = req.body.typeIds
        ? req.body.typeIds
        : foundProduct.typeIds;

      return foundProduct.save().then(product => {
        return res.json({ data: product });
      });
    })
    .catch(err => {
      if (!(err instanceof APIError)) {
        console.error(err);
        err = new APIError(
          'Error updating Product',
          httpStatus.INTERNAL_SERVER_ERROR
        );
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
