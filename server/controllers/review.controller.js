// @flow

import httpStatus from 'http-status';
import request from 'request';

import APIError from '../helpers/APIError';
import Order, { OrderDoc } from '../models/order.model';
import Review, { ReviewDoc } from '../models/review.model';
import User, { UserDoc } from '../models/user.model';

import config from '../config/config';

declare class session$Request extends express$Request {
  order: OrderDoc;
  user: UserDoc;
}

/**
 * Get users's reviews
 *
 * GET /api/users/:userId/reviews
 *
 * @property {*} req - express session
 * @property {*} req.params - express session parameters
 * @property {MongoId} req.params.userId
 * @property {*} req.query - express session query
 * @property {string} req.query.as buyer|seller|both
 */
async function list(req: session$Request, res: express$Response, next) {
  const { userId } = req.params;
  const { as } = req.query;
  // const { limit = 50, lastId } = req.query;
  // TODO: paginate inside list of reviews` array using limit & lastId

  try {
    const user = await User.findById(userId);
    if (!user) {
      const APIerr = new APIError('Invalid userId', httpStatus.BAD_REQUEST);
      return next(APIerr);
    }
    let match = {};
    let query = { targetUser: userId };
    if ('buyer' == as) {
      match = { buyer: userId };
    }
    if ('seller' == as) {
      match = { seller: userId };
    }
    if ('both' == as) {
      query = {
        $or: [{ targetUser: userId }, { fromUser: userId }],
      };
    }
    let reviews = await Review.find(query).populate({
      path: 'order',
      match,
      populate: { path: 'product buyer seller' },
    });

    reviews = reviews.filter(r => r.order !== null);

    return res.json({ data: reviews });
  } catch (err) {
    const APIerr = new APIError(err, httpStatus.BAD_REQUEST);
    return next(APIerr);
  }
}

/**
 * Create new review and create notification for the target
 *
 * POST /api/users/:userId/reviews
 *
 * @property {*} req Express request
 * @property {*} req.params Express params parameters
 * @property {string} req.params.userId The product userId (FIXME: remove param and rewrite API route)
 * @property {*} req.body Express body parameters
 * @property {string} req.body.orderId
 * @property {string} req.body.text
 * @property {number} req.body.rateNumber
 * @property {string} req.body.lang
 * @property {number} req.body.trackingNumber
 */
async function create(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  if (req.user.accountStatus !== 'verified') {
    const APIerr = new APIError(
      'Please verify your account before creating a review.',
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }
  const { orderId } = req.body;
  let order: OrderDoc;

  try {
    order = await Order.get(orderId);

    // TODO: after integration with payment provider do not allow reviews on `pending` status
    if (
      [
        'completed',
        'failed_by_buyer',
        'failed_by_seller',
        'failed',
        'pending',
      ].indexOf(order.status) < 0
    ) {
      throw new APIError(
        `Cannot create review on an order that is '${order.status}'`,
        httpStatus.BAD_REQUEST
      );
    }

    const iAmTheSeller = req.user._id.toString() == order.seller._id.toString();
    const iAmTheBuyer = req.user._id.toString() == order.buyer._id.toString();

    if (!iAmTheSeller && !iAmTheBuyer) {
      throw new APIError(
        `Cannot create review on an order that you're not part of`,
        httpStatus.BAD_REQUEST
      );
    }

    const targetUser = iAmTheSeller ? order.buyer._id : order.seller._id;
    let { text, rateNumber, lang, trackingNumber } = req.body;

    if (config.env !== 'test') {
      try {
        const isValid = await isValidTrackingNumber(
          trackingNumber,
          order.datePending
        );
        if (!isValid) {
          const APIerr = new APIError(
            'The tracking number is not valid',
            httpStatus.BAD_REQUEST
          );
          return next(APIerr);
        }
      } catch (error) {
        console.error(error);
        const APIerr = new APIError(
          'The tracking number is not valid',
          httpStatus.INTERNAL_SERVER_ERROR
        );
        return next(APIerr);
      }
    }

    const review: ReviewDoc = new Review({
      fromUser: iAmTheSeller ? order.seller._id : order.buyer._id,
      targetUser,
      order: orderId,
      text,
      rateNumber,
      lang,
    });

    if (order.trackingNumber && order.trackingNumber !== trackingNumber) {
      throw new APIError(
        'The tracking number is not valid',
        httpStatus.BAD_REQUEST
      );
    }

    let savedReview = await review.save();
    savedReview = { ...savedReview.toJSON(), order };

    await User.findByIdAndUpdate(targetUser, {
      $inc: { reviewsCount: 1, ratingsTotal: rateNumber },
    });

    await Order.findByIdAndUpdate(orderId, { trackingNumber }).exec();

    res.status(httpStatus.CREATED).json({ data: savedReview });
  } catch (err) {
    next(err);
  }
}

/**
 * if the tracking number schedule delivery date is greater than the date creation date (datePending)
 */
async function isValidTrackingNumber(
  trackingNumber: string,
  orderDatePending: Date
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    request.post(
      'https://api.novaposhta.ua/v2.0/json/documentsTracking/',
      {
        json: {
          modelName: 'TrackingDocument',
          calledMethod: 'getStatusDocuments',
          methodProperties: {
            Documents: [
              {
                DocumentNumber: trackingNumber,
                Phone: '',
              },
            ],
          },
        },
      },
      (error, response, body) => {
        if (error) return reject(error);

        if (!body.success) return reject(body);

        const data = body.data[0];

        // Number not found
        if (data.StatusCode == '3' || !data.ScheduledDeliveryDate)
          return resolve(false);

        // e.g. convert `string` 08-05-2018 to a `Date` Tue May 08 2018
        const trackingNumberDate = new Date(
          data.ScheduledDeliveryDate.replace(
            /(\d{2})-(\d{2})-(\d{4})/,
            '$2/$1/$3'
          )
        );
        const orderDate = new Date(orderDatePending);

        if (trackingNumberDate.getTime() > orderDate.getTime()) {
          return resolve(true);
        }
        resolve(false);
      }
    );
  });
}

export default {
  list,
  create,
};
