// @flow

const debug = require('debug')('express-mongoose-es6-rest-api:index');

import httpStatus from 'http-status';
import APIError from '../helpers/APIError';
import Order, { OrderDoc } from '../models/order.model';
import Product, { ProductDoc } from '../models/product.model';
import { UserDoc } from '../models/user.model';
import notifCtrl, {
  NotifPayload,
} from '../controllers/notification.controller';
import Review from '../models/review.model';

declare class express$Request extends express$Request {
  order: OrderDoc;
  user: UserDoc;
}

const i18n = {
  orderPaid: 'Congrats! 🎉 You have a new purchase!', // 36 chars
  orderShipped: 'Your purchase has been shipped! 🎉', // 34 chars
  orderCancelled: 'Your order has been cancelled! 😭', // 34 chars
};

const ONOVA_RATE = 1; // 1 = 0% -- 1.2 = 20%

/**
 * @private
 *
 * Load a order and append to req.
 */
function load(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction,
  id: string
) {
  // use static method from OrderSchema
  // flow-disable-next-line
  Order.get(id)
    .then(async (order: OrderDoc) => {
      req.order = order;
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get order
 *
 * GET /api/orders/:orderId
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express session parameters
 * @property {string} req.params.id - The id of the order.
 */
async function get(req: express$Request, res: express$Response) {
  return res.json({
    data: {
      ...req.order.toJSON(),
      reviewedByBuyer: req.reviewedByBuyer,
      reviewedBySeller: req.reviewedBySeller,
    },
  });
}

/**
 * Create new order
 *
 * POST /api/orders
 *
 * @property {*} req - Express request
 * @property {*} req.body - Express body parameters
 * @property {bson$ObjectId} req.body.product - uuid
 */
function create(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  let foundProduct: ProductDoc;

  if (req.user.accountStatus !== 'verified') {
    throw new APIError(
      'Please verify your account before buying a product.',
      400
    );
  }

  Product.findOne({ uuid: req.body.product })
    .populate('seller')
    .then((product: ProductDoc) => {
      if (!product) {
        throw new APIError('Product not found', 404);
      }
      if (product.status !== 'forsale') {
        throw new APIError(
          'This product is not longer for sale or is reserved.',
          httpStatus.BAD_REQUEST
        );
      }
      foundProduct = product;
      return product;
    })
    .then(product => {
      if (req.user._id.toString() === product.seller._id.toString()) {
        throw new APIError(
          'You cannot buy your own items',
          httpStatus.BAD_REQUEST
        );
      }

      const pPrice = product.price.toString();
      const onovaFee = (parseFloat(pPrice) * ONOVA_RATE).toString();

      const order = new Order({
        buyer: req.user._id,
        currency: product.currency, // 'UAH' by default
        // datePending // Date.now by default
        onovaFee: onovaFee,
        priceOfItem: product.price,
        product: product._id,
        seller: product.seller._id,
        // status // 'pending' by default
      });

      return order.save();
    })
    .then(savedOrder => {
      // const notif: NotifPayload = {
      //   notifI18n: i18n.newOrder,
      //   targetUser: foundProduct.seller._id,
      //   triggeredBy: savedOrder._id,
      //   triggeredType: 'Order',
      // };

      // Notification is sent to seller only after payment is completed
      // notifCtrl
      //   .createNotification(notif)
      //   .then(() => {
      //     debug('newOrder notification created');
      //   })
      //   .catch(err => {
      //     console.error(err);
      //   });

      return res.status(httpStatus.CREATED).json({
        data: {
          ...savedOrder.toJSON(),
          reviewedByBuyer: false,
          reviewedBySeller: false,
        },
      });
    })
    .catch(e => {
      if (e.message == 'Duplicate order') {
        Order.findOne({ buyer: req.user._id, product: foundProduct._id }).then(
          data => {
            return res
              .status(httpStatus.BAD_REQUEST)
              .json({ message: e.message, data });
          }
        );
      } else {
        next(e);
      }
    });
}

/**
 * Update an order's status and/or paymentMethod
 *
 * PUT /api/orders/:orderId
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {MongoId} req.query.orderId
 * @property {string} req.query.status
 * @property {string=} req.query.paymentMethod
 */
function update(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { archive, reason, status: newStatus } = req.body;

  const iAmTheSeller =
    req.user._id.toString() == req.order.seller._id.toString();

  const foundOrder = req.order;

  // can go only from either 'paid' or 'pending' -> 'cancelled'
  if (
    ['shipped', 'completed'].indexOf(foundOrder.status) > -1 &&
    newStatus == 'cancelled'
  ) {
    throw new APIError(
      'cannot cancel an order that has been shipped or completed',
      httpStatus.BAD_REQUEST
    );
  }

  if (foundOrder.status == 'cancelled') {
    throw new APIError(
      'cannot change the status of an order once is cancelled',
      httpStatus.BAD_REQUEST
    );
  }

  if (newStatus && archive) {
    throw new APIError(
      'cannot change the status and archive at the same time',
      httpStatus.BAD_REQUEST
    );
  }

  if (archive) {
    if (iAmTheSeller) {
      foundOrder.archivedBySeller = true;
    } else {
      foundOrder.archivedByBuyer = true;
    }
  }

  // // can go only from either 'paid' or 'shipped' -> 'completed'
  // if (foundOrder.status == 'pending' && newStatus == 'completed') {
  //   throw new APIError('cannot complete an order that is pending', 400);
  // }

  // TODO: move this to a function that changes the state and keeps a transition log
  // // can go only from either 'pending' -> 'paid'
  // if (
  //   ['shipped', 'completed'].indexOf(foundOrder.status) > -1 &&
  //   newStatus == 'paid'
  // ) {
  //   throw new APIError(
  //     'cannot set an order status to paid if its not pending first',
  //     400
  //   );
  // }

  if (newStatus == 'confirmed') {
    // only the seller can confirm the order
    if (!iAmTheSeller) {
      const err = new APIError('Unauthorized', httpStatus.UNAUTHORIZED);
      return next(err);
    }

    foundOrder.dateConfirmed = new Date();
  }

  if (newStatus == 'cancelled') {
    // required the seller to enter a reason
    if (!reason && iAmTheSeller) {
      const err = new APIError('"reason" is required', httpStatus.BAD_REQUEST);
      return next(err);
    }
    if (iAmTheSeller) {
      foundOrder.reason = reason;
    }
    foundOrder.dateCancelled = new Date();
  }

  foundOrder.status = newStatus ? newStatus : foundOrder.status;
  foundOrder.paymentMethod = req.body.paymentMethod
    ? req.body.paymentMethod
    : foundOrder.paymentMethod;

  if (newStatus) {
    createOrderNotification(foundOrder)
      .then(() => {
        debug('notification(s) created for order:', newStatus);
      })
      .catch(e => console.error(e));
  }

  return foundOrder.save().then(order => {
    return res.json({
      data: {
        ...order.toJSON(),
        reviewedByBuyer: req.reviewedByBuyer,
        reviewedBySeller: req.reviewedBySeller,
      },
    });
  });
}

/**
 * Get list of my orders.
 *
 * GET /api/orders
 *
 * @property {*} req - Express request
 * @property {*} req.query - Express query parameters
 * @property {number} req.query.skip Number of orders to be skipped.
 * @property {number} req.query.limit Limit number of orders to be returned.
 */
function list(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { limit = 50, skip = 0 } = req.query;
  // use static method from orderSchema
  // flow-disable-next-line
  Order.list({ myid: req.user._id, limit, skip })
    .then(orders => res.json({ data: orders }))
    .catch(e => next(e));
}

/**
 * Creates the approprate notification(s) for each order status transition
 *
 * See graph in `ORDER_PROCESS.md`
 */
function createOrderNotification(order: OrderDoc) {
  let notif: NotifPayload = {
    triggeredBy: order._id,
    triggeredType: 'Order',
  };
  switch (order.status) {
    case 'confirmed':
      // TODO: send 2 notifications
      return Promise.resolve();
    case 'paid':
      // TODO: test
      notif = {
        ...notif,
        notifI18n: i18n.orderPaid,
        targetUser: order.seller,
        sourceUser: req.user,
      };

      return notifCtrl.createNotification(notif);
      break;
    case 'shipped':
      // TODO: test
      notif = {
        ...notif,
        notifI18n: i18n.orderShipped,
        targetUser: order.buyer._id,
        sourceUser: req.user,
      };

      return notifCtrl.createNotification(notif);
      break;
    case 'cancelled':
      // cancelled by seller. there is no notification if the buyer cancels
      notif = {
        ...notif,
        notifI18n: i18n.orderCancelled,
        targetUser: order.buyer._id,
        sourceUser: order.seller._id,
      };

      return notifCtrl.createNotification(notif);
      break;
  }
}

export default {
  load,
  get,
  create,
  update,
  list,
};
