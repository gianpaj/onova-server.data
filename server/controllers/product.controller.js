// @flow

import shortid from 'shortid';
import mongoose from 'mongoose';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import photos from '../helpers/photos';
import Block from '../models/block.model';
import Product, { ProductDoc } from '../models/product.model';
import Tag, { TagDoc } from '../models/tag.model';
import User, { UserDoc, userPopulateFields } from '../models/user.model';
import config from '../config/config';
import path from 'path';

const geocoder = require('offline-geocoder')({
  database: path.join(__dirname, '../../db.sqlite'),
});

function escapeRegex(text: string) {
  return text.replace(/[^a-zA-Z0-9_]/g, '\\$&');
}

declare class session$Request extends express$Request {
  user: UserDoc;
  product: ProductDoc;
  body: {
    categoryIds: string,
    description: string,
    photos: Array<string>,
    price: string,
    typeIds: string,
    tags: Array<TagDoc>,
    latitude: number,
    longitude: number,
  };
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
      select: userPopulateFields,
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
 * @property {Array<string>} req.body.photos
 * @property {string} req.body.price
 * @property {MongoId} req.body.seller
 * @property {Array<string>=} req.body.tags
 * @property {Array<number>} req.body.typeIds
 * @property {number} req.body.longitude
 * @property {number} req.body.latitude
 */
async function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { body } = req;
  const product = new Product({
    categoryIds: body.categoryIds,
    // currency: body.currency,
    description: body.description,
    price: body.price,
    // status: body.status, // 'forsale' by default
    tags: body.tags,
    typeIds: body.typeIds,
    uuid: shortid.generate(), // needed here for photos' filenames
  });

  if (body.longitude && body.latitude) {
    product.location = {
      type: 'Point',
      coordinates: [body.longitude, body.latitude],
    };

    try {
      const geodata = await geocoder.reverse(body.latitude, body.longitude);
      product.locality = geodata.admin1.name;
    } catch (err) {
      console.error(err);
      const APIerr = new APIError('Invalid location', 400);
      return next(APIerr);
    }
  }

  if (/\.\d{1}$/.test(product.price)) {
    product.price += '0';
  }

  // create Tag documents
  if (body.tags) createTags(body.tags);

  User.findById(req.user._id)
    .then(async seller => {
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

      const correctPhotos = body.photos.filter(p =>
        p.startsWith('https://storage.googleapis.com/temp-uploads.onova.co/')
      );

      if (correctPhotos.length < 1) {
        throw new APIError('Product photo(s) are required', 400);
      }

      const date = Date.now();

      // TODO: check if images have been uploaded to GSC
      let promises = [];

      const thumb = correctPhotos[0].replace('.jpeg', 'thumb.jpeg');
      promises.push(photos.copyPhoto(thumb, product.uuid, 0, date, true));

      correctPhotos.map((p, i) =>
        promises.push(photos.copyPhoto(p, product.uuid, i, date))
      );

      try {
        const photos = await Promise.all(promises);
        product.photoURIs = photos.filter(photo => !photo.includes('thumb'));
      } catch (err) {
        console.error(err);
        throw new APIError('Error copying photos', 500);
      }

      return product
        .save()
        .then(savedProduct => savedProduct)
        .catch(e => {
          console.error(e);
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
 * @property {number|Array<number>=} req.query.categoryIds
 * @property {MongoId=} req.query.lastId (not uuid)
 * @property {number=} req.query.limit Limit number of products to be returned
 * @property {array<string>|string=} req.query.tags
 * @property {string=} req.query.userid (or username)
 * @property {string=} req.query.username (or userid)
 */
async function list(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { categoryIds, lastId, limit = 50, tags, userid, username } = req.query;
  const projection = { comments: 0 };
  let query = { status: 'forsale' };

  if (config.env !== 'test') {
    query = { ...query, photoURIs: { $exists: true, $not: { $size: 0 } } };
  }

  // TODO: escapeRegex each tag
  if (tags) {
    if (Array.isArray(tags)) {
      const regexAllTags = tags.map(tag => new RegExp(escapeRegex(tag), 'i'));
      query = { ...query, tags: { $in: regexAllTags } };
    } else {
      const regexTag = new RegExp(escapeRegex(tags), 'i');
      query = { ...query, tags: regexTag };
    }
  }
  if (categoryIds) query = { ...query, categoryIds: { $in: categoryIds } };

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
  } else if (username) {
    // search products by seller's username (no pagination[lastId] yet allowed)
    return User.findOne({ username })
      .then(user => {
        if (!user) {
          const APIerr = new APIError('No seller found', httpStatus.NOT_FOUND);
          return next(APIerr);
        }

        query = { ...query, seller: user._id };

        // use static method from ProductSchema
        return Product.list({ query, projection }).then(data =>
          res.json({ data })
        );
      })
      .catch(e => next(e));
  }

  // for pagination - results are excluding the lastId
  if (lastId) {
    return Product.findById(lastId).then(product => {
      if (!product) {
        const APIerr = new APIError('Product not found.', httpStatus.NOT_FOUND);
        return next(APIerr);
      }

      query = { ...query, _id: { $lt: lastId } };

      return Product.list({ query, projection, limit }).then(data =>
        res.json({ data })
      );
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
  if (req.product.status !== 'forsale') {
    // item could be already sold or deleted, etc.
    throw new APIError('Product not found', httpStatus.BAD_REQUEST);
  }

  const { uuid } = req.params;

  Product.findOneAndUpdate({ uuid, status: 'forsale' }, { status: 'deleted' })
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
 * @property {Array<string>} req.body.photos
 * @property {string} req.body.price
 * @property {Array<string>=} req.body.tags
 * @property {Array<number>} req.body.typeIds
 */
function update(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { body } = req;

  Product.findOne({ uuid: req.params.uuid })
    .then(async foundProduct => {
      if (!foundProduct) {
        throw new APIError('Product not found', 400);
      }

      if (foundProduct.status === 'sold') {
        throw new APIError('Cannot update a product that has been sold', 400);
      }

      // create Tag documents
      if (body.tags) createTags(body.tags);

      if (body.photos) {
        const date = Date.now();

        // TODO: check if photos have been uploaded to GSC
        try {
          const newPhotos = [];
          for (let i = 0; i < body.photos.length; i++) {
            const photo = body.photos[i];

            if (i === 0) {
              const firstPhoto = body.photos[i];
              // if the first existing photo is re-sorted, re-generate the thumbnail
              if (
                firstPhoto !== foundProduct.photoURIs[i] &&
                firstPhoto.indexOf('/temp-uploads') === -1
              ) {
                await photos.generateThumbnail(firstPhoto);
              } else {
                // if the first photo is new copy the thumbnail (from temp)
                const thumb = photo.replace('.jpeg', 'thumb.jpeg');
                await photos.copyPhoto(thumb, foundProduct.uuid, 0, date, true);
              }
            }

            // if the photo is not new
            if (photo.indexOf('/temp-uploads') === -1) {
              newPhotos[i] = photo;
              continue;
            }

            const p = await photos.copyPhoto(photo, foundProduct.uuid, i, date);
            newPhotos[i] = p;
          }
          foundProduct.photoURIs = newPhotos;
        } catch (err) {
          console.error(err);
          throw new APIError('Error copying photos', 500);
        }
      }

      foundProduct.categoryIds = body.categoryIds
        ? body.categoryIds
        : foundProduct.categoryIds;
      foundProduct.description = body.description
        ? body.description
        : foundProduct.description;

      if (/\.\d{1}$/.test(body.price)) {
        body.price += '0';
      }

      foundProduct.price = body.price
        ? mongoose.Types.Decimal128.fromString(body.price)
        : foundProduct.price;
      foundProduct.tags = body.tags ? body.tags : foundProduct.tags;
      foundProduct.typeIds = body.typeIds ? body.typeIds : foundProduct.typeIds;

      return foundProduct.save();
    })
    .then(product => {
      return res.json({ data: product });
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
