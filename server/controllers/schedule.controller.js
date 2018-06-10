// @flow

import shortid from 'shortid';
import httpStatus from 'http-status';
import differenceInCalendarDays from 'date-fns/difference_in_calendar_days';

import APIError from '../helpers/APIError';
import Product, { ProductDoc } from '../models/product.model';
import Tag, { TagDoc } from '../models/tag.model';
import User, { UserDoc } from '../models/user.model';
import config from '../config/config';

declare class session$Request extends express$Request {
  files: Array<any>;
  user: UserDoc;
  product: ProductDoc;
  body: {
    categoryIds: string,
    date: Date,
    description: string,
    price: string,
    typeIds: string,
    tags: Array<TagDoc>,
    photos: Array<string>,
    socials: Array<string>,
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
 * Schedule a new listing
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

  if (/\.\d{1}$/.test(product.price)) {
    product.price += '0';
  }

  if (differenceInCalendarDays(body.date, new Date(Date.now())) > 90) {
    const APIerr = new APIError(
      'Cannot schedule listings 90 days from today',
      400
    );
    return next(APIerr);
  }

  // create Tag documents
  if (body.tags) createTags(body.tags);

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
        product.photoURIs = ['1527232263107'];
      } else {
        product.photoURIs = body.photos;
        // photos.uploadProductImages(product, req.files);
      }

      // TODO: check if images have been uploaded to GSC

      // Copy images to assets' bucket

      // body.socials;

      return product
        .save()
        .then(savedProduct => savedProduct)
        .catch(() => {
          throw new APIError(
            'Error scheduling a listing',
            httpStatus.INTERNAL_SERVER_ERROR
          );
        });
    })
    .then(savedProduct => {
      return res.status(httpStatus.CREATED).json({ data: savedProduct });
    })
    .catch(e => next(e));
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
  // get,
  create,
};
