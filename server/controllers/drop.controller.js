// @flow

import httpStatus from 'http-status';
import shortid from 'shortid';
import { differenceInCalendarDays, differenceInSeconds } from 'date-fns';

import { agenda } from '../config/express';
import config from '../config/config';

import photoHelper from '../helpers/photos';
import APIError from '../helpers/APIError';
import {
  Drop,
  DropDoc,
  Follow,
  FollowDoc,
  User,
  UserDoc,
  Product,
  ProductDoc,
} from '../models';

const { minPrice } = config.settings;

export const i18n = {
  // listedDrop: 'Your drop has been posted',
  listedDrop: 'Ваш Дроп виставлено на продаж',
};

declare class session$Request extends express$Request {
  user: UserDoc;
}

/**
 * Get list of scheduled drops of the people who i am following
 *
 * GET /api/feed/drops
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
//  * @property {MongoId} req.query.lastId
//  * @property {number} req.query.limit Limit number of drops to be returned.
 */
async function myFeed(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  // const { limit = 50 } = req.query;

  try {
    const following: Array<FollowDoc> = await Follow.find({
      follower: req.user._id,
      status: { $ne: -1 }, // those who i am blocking
    }).limit(1000);
    if (!following.length) return res.json({ data: [] });

    // console.log(following);
    let followingIDs = following.map(f => f.following);

    // filter the us
    let blockedByIDs = [];
    const blockedBy = await Follow.find({
      following: req.user._id,
      status: -1,
    });
    if (blockedBy) {
      blockedByIDs = blockedBy.map(f => f.following);
      followingIDs = followingIDs.filter(id => -1 === blockedByIDs.indexOf(id));
    }

    // for pagination - results are excluding the lastId
    // if (lastId) {
    //   DBquery = { ...DBquery, _id: { $lt: lastId } };

    //   const lastIdProd = await Product.findById(lastId);
    //   if (!lastIdProd) {
    //     throw new APIError('Product not found.', httpStatus.NOT_FOUND);
    //   }
    // }

    const now = new Date();

    agenda.jobs(
      {
        name: config.JOBNAMES.SCHEDULE,
        'data.product.seller': { $in: followingIDs },
        $or: [
          // scheduled
          {
            nextRunAt: { $gte: now },
          },
          // queued
          {
            nextRunAt: { $lte: now },
            $expr: {
              $gte: ['$nextRunAt', '$lastFinishedAt'],
            },
          },
        ],
      },
      (err, jobs: Array<any>) => {
        if (err) {
          const e = new APIError(
            'Error getting scheduled listing',
            httpStatus.SERVICE_UNAVAILABLE
          );
          return next(e);
        }

        if (!jobs.length) return res.json({ data: [] });

        const scheduled = jobs.map(job => ({
          lastFinishedAt: job.attrs.lastFinishedAt
            ? job.attrs.lastFinishedAt
            : null,
          nextRunAt: job.attrs.nextRunAt,
          ...job.attrs.data.product,
        }));

        // group jobs by dropId
        // inspired by https://stackoverflow.com/a/47385953/728287
        const result = scheduled.reduce(
          (accumulator, currentValue) => ({
            ...accumulator,
            [currentValue.dropId]: (
              accumulator[currentValue.dropId] || []
            ).concat(currentValue),
          }),
          {}
        );

        return res.json({ data: result });
      }
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Create a drop a new listing with a specific dropId
 *
 * POST /api/v2/drop
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {string} req.body.description
 * @property {string} req.body.date
 * @property {number=} req.body.latitude
 * @property {number=} req.body.longitude
 * @property {Array<Object>} req.body.products
 * @property {Array<number>} req.body.products.categoryIds
 * @property {Array<string>=} req.body.products.photos
 * @property {string} req.body.products.price
 * @property {Array<string>=} req.body.products.tags
 * @property {Array<number>} req.body.products.typeIds
 */
async function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { body } = req;

  try {
    if (differenceInCalendarDays(body.date, Date.now()) > 90) {
      throw new APIError('Cannot create a drop 90 days from today', 400);
    }

    validateProducts(body.products);

    const seller = await User.findById(req.user._id);

    validateSeller(seller);

    // if the date is not further than 30 seconds in the future, mark it as posted, skipping the job scheduler
    // but for testing only is not further thatn 3 seconds in the future
    const secondsDiff = config.env === 'test' ? 2 : 30;
    const posted =
      Math.abs(differenceInSeconds(new Date(), body.date)) <= secondsDiff;

    const drop = new Drop({
      scheduledAt: body.date,
      seller: req.user._id,
      posted,
    });

    const date = new Date();
    const products = body.products.map(async prod => {
      const product = new Product({
        categoryIds: prod.categoryIds,
        // currency: prod.currency,
        description: prod.description,
        dropId: drop._id,
        price: parseFloat(prod.price).toFixed(2),
        // status: prod.status, // 'forsale' by default
        tags: prod.tags,
        typeIds: prod.typeIds,
        uuid: shortid.generate(), // needed here for photos' filenames
        // createdAt: new Date(body.date),
        seller: req.user._id,
        status: posted ? 'forsale' : 'ready',
      });

      let promises = [];

      for (let i = 0; i < prod.photos.length; i++) {
        const photo = prod.photos[i];
        const thumb = photo.replace('.jpg', '-thumb.jpg');
        const thumb2x = photo.replace('.jpg', '-thumb@2x.jpg');
        promises.push(
          photoHelper.copyPhoto(thumb, product.uuid, i, date, '-thumb')
        );
        promises.push(
          photoHelper.copyPhoto(thumb2x, product.uuid, i, date, '-thumb@2x')
        );
      }

      prod.photos.map((p, i) =>
        promises.push(photoHelper.copyPhoto(p, product.uuid, i, date))
      );

      try {
        const photos = await Promise.all(promises);
        product.photoURIs = photos.filter(photo => !photo.includes('thumb'));
      } catch (err) {
        console.error(err);
        throw new APIError('Error copying photos', 500);
      }

      return Product.create(product);
    });

    const savedProducts = await Promise.all(products);

    drop.products = savedProducts.map(p => p._id);

    await drop.save();

    if (!posted) {
      // schedule a single job that it's only job is to set the products as 'forsale', from 'ready'
      // and to set the Drop as
      await agenda.schedule(body.date, config.JOBNAMES.SCHEDULE, drop, err => {
        if (err) throw new APIError(`Error scheduling a drop: ${err}`);
      });
    }

    return res.status(httpStatus.CREATED).json({ data: drop });
  } catch (error) {
    if (!(error instanceof APIError)) console.error(error);
    next(error);
  }
}

function validateProducts(products: Array<ProductDoc>) {
  products.forEach(product => {
    if (parseFloat(product.price) < minPrice) {
      throw new APIError(
        `Invalid product price. The minimum price is ${minPrice} UAH`,
        httpStatus.BAD_REQUEST
      );
    }

    const correctPhotos = product.photos.filter(p =>
      p.startsWith('https://storage.googleapis.com/temp-uploads.onova.co/')
    );

    if (correctPhotos.length < 1) {
      throw new APIError('Invalid photos', httpStatus.BAD_REQUEST);
    }
    // throw new APIError('asdf', httpStatus.BAD_REQUEST);
  });
}

function validateSeller(seller) {
  if (!seller) {
    throw new APIError('Seller not found', httpStatus.BAD_REQUEST);
  }
  if (seller.accountStatus !== 'verified') {
    throw new APIError(
      'Please verify your account before creating a drop',
      httpStatus.BAD_REQUEST
    );
  }
  if (
    !seller.shippingAddress.departmentNovaposhta ||
    !seller.shippingAddress.city
  ) {
    throw new APIError(
      'Please enter your shipping address info before creating a drop',
      httpStatus.BAD_REQUEST
    );
  }
  if (!seller.paymentInfo.method || !seller.paymentInfo.card_token) {
    throw new APIError(
      'Please enter your payment info before creating a drop',
      httpStatus.BAD_REQUEST
    );
  }
}

export default {
  create,
  myFeed,
  // myFriendsFeed
  // subscribe,
  // unsubscribe,
};
