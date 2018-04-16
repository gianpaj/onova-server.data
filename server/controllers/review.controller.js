// @flow

import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import Order, { OrderDoc } from '../models/order.model';
import Review, { ReviewDoc } from '../models/review.model';
import notifCtrl, {
  NotifPayload,
} from '../controllers/notification.controller';
import User, { UserDoc } from '../models/user.model';

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
async function get(req: session$Request, res: express$Response, next) {
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
 * @property {string} req.params.userId The product userId
 * @property {*} req.body Express body parameters
 * @property {string} req.body.orderId
 * @property {string} req.body.text
 * @property {string} req.body.rateNumber
 * @property {string} req.body.lang
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
  } catch (err) {
    return next(err);
  }

  if (
    ['completed', 'failed_by_buyer', 'failed_by_seller', 'failed'].indexOf(
      order.status
    ) < 0
  ) {
    const APIerr = new APIError(
      `Cannot create review on an order that is '${order.status}'`,
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  const iAmTheSeller = req.user._id.toString() == order.seller._id.toString();
  const iAmTheBuyer = req.user._id.toString() == order.buyer._id.toString();

  if (!iAmTheSeller && !iAmTheBuyer) {
    const APIerr = new APIError(
      `Cannot create review on an order that you're not part of`,
      httpStatus.BAD_REQUEST
    );
    return next(APIerr);
  }

  let { text, rateNumber, lang } = req.body;
  const review: ReviewDoc = new Review({
    fromUser: iAmTheSeller ? order.seller._id : order.buyer._id,
    targetUser: iAmTheSeller ? order.buyer._id : order.seller._id,
    order: orderId,
    text,
    rateNumber,
    lang,
  });

  try {
    let savedReview = await review.save();
    savedReview = { ...savedReview.toJSON(), order };

    await User.findByIdAndUpdate(
      iAmTheSeller ? order.seller._id : order.buyer._id,
      { $inc: { reviewsCount: 1, ratingsTotal: rateNumber } }
    );

    res.status(httpStatus.CREATED).json({ data: savedReview });
  } catch (err) {
    next(err);
  }
}

export default {
  get,
  create,
};
