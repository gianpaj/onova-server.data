// @flow

import shortid from 'shortid';
import httpStatus from 'http-status';
import differenceInCalendarDays from 'date-fns/difference_in_calendar_days';
import path from 'path';
// const debug = require('debug')('express-mongoose-es6-rest-api:index');
const geocoder = require('offline-geocoder')({
  database: path.join(__dirname, '../../db.sqlite'),
});

import { agenda } from '../config/express';
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
  body: {
    categoryIds: string,
    date: Date,
    description: string,
    price: string,
    typeIds: string,
    tags: Array<TagDoc>,
    photos: Array<string>,
    // socials: Array<string>,
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
 * Schedule a new listing
 *
 * POST /api/schedule
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {Array<number>} req.body.categoryIds
 * @property {string=} [req.body.currency='UAH']
 * @property {string} req.body.description
 * @property {Array<string>=} req.body.photos
 * @property {string} req.body.price
 * @property {MongoId} req.body.seller
 * @property {Array<string>=} req.body.tags
 * @property {Array<number>} req.body.typeIds
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

  if (differenceInCalendarDays(body.date, Date.now()) > 90) {
    const APIerr = new APIError(
      'Cannot schedule listings after 90 days from today',
      400
    );
    return next(APIerr);
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

      // if (body.socials.indexOf('fb') > -1 && !seller.facebook) {
      //   throw new APIError('Please authorize with Facebook', 400);
      // }

      product.seller = req.user._id;

      // for (let i = 0; i < req.files.length; i++) {
      //   product.photoURIs.push('UPLOADING_PIC');
      // }

      const correctPhotos = body.photos.filter(p =>
        p.startsWith('https://storage.googleapis.com/temp-uploads.onova.co/')
      );

      if (correctPhotos.length < 1) {
        throw new APIError('Invalid photos', 400);
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
        throw new APIError('Error moving photos', 500);
      }

      const jobData = {
        // socials: body.socials,
        product,
      };

      return agenda.schedule(
        body.date,
        config.JOBNAMES.SCHEDULE,
        jobData,
        err => {
          if (err) throw new APIError(`Error scheduling a listing: ${err}`);
        }
      );
    })
    .then(savedListing => {
      return res.status(httpStatus.CREATED).json({ data: savedListing });
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
