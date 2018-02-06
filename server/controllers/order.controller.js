// @flow

import APIError from '../helpers/APIError';
import Order, { OrderDoc } from '../models/order.model';
import Product, { ProductDoc } from '../models/product.model';
import User, { UserDoc } from '../models/user.model';
import config from '../config/config';

declare class express$Request extends express$Request {
  order: OrderDoc;
  user: UserDoc;
}

const ONOVA_RATE = 1; // 1 = 0 % -- 1.2 = 20%

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
    .then((order: OrderDoc) => {
      req.order = order;
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get order
 *
 * GET /api/orders/:uuid
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express session parameters
 * @property {string} req.params.id - The id of the order.
 */
function get(req: express$Request, res: express$Response) {
  return res.json({ data: req.order });
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
  if (req.user.accountStatus !== 'verified') {
    throw new APIError(
      'Please verify your account before buying a product.',
      400
    );
  }

  Product.findOne({ uuid: req.body.product })
    .populate('seller')
    .then((product: productDoc) => {
      if (!product) {
        throw new APIError('Product not found', 400);
      }
      if (product.status !== 'forsale') {
        throw new APIError(
          'This product is not longer for sale or is reserved.',
          400
        );
      }
      return product;
    })
    .then(product => {
      if (req.user._id.toString() === product.seller._id.toString()) {
        throw new APIError('You cannot buy your own items', 400);
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

      return order
        .save()
        .then(savedOrder => savedOrder)
        .catch(() => {
          throw new APIError('Error creating Order', 400);
        });
    })
    .then(savedOrder => {
      return res.status(201).json({ data: savedOrder });
    })
    .catch(e => next(e));
}

/**
 * Update an order's status
 *
 * GET /api/orders/:uuid
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
  const newStatus = req.body.status;

  const a = req.order;

  Order.findOne({ _id: req.params.orderId })
    .then(foundOrder => {
      if (!foundOrder) {
        throw new APIError('Order not found', 400);
      }

      // can go only from either 'purchased' or 'pending' -> 'cancelled'
      if (
        ['shipped', 'completed'].indexOf(foundOrder.status) > -1 &&
        newStatus == 'cancelled'
      ) {
        throw new APIError(
          'cannot cancel an order that has been shipped or completed',
          400
        );
      }

      if (foundOrder.status == 'cancelled') {
        throw new APIError(
          'cannot change the status of an order once is cancelled',
          400
        );
      }

      // can go only from either 'purchased' or 'shipped' -> 'completed'
      if (foundOrder.status == 'pending' && newStatus == 'completed') {
        throw new APIError('cannot complete an order that is pending', 400);
      }

      // can go only from either 'pending' -> 'purchased'
      if (
        ['shipped', 'completed'].indexOf(foundOrder.status) > -1 &&
        newStatus == 'purchased'
      ) {
        throw new APIError(
          'cannot set an order status to purchased if its not pending first',
          400
        );
      }

      if (newStatus == 'purchased') {
        foundOrder.datePurchased = new Date();
      }

      if (newStatus == 'shipped') {
        foundOrder.dateShipped = new Date();
      }

      if (newStatus == 'completed') {
        foundOrder.dateCompleted = new Date();
      }

      foundOrder.status = newStatus ? newStatus : foundOrder.status;
      foundOrder.paymentMethod = req.body.paymentMethod
        ? req.body.paymentMethod
        : foundOrder.paymentMethod;

      return foundOrder.save().then(data => {
        return res.json({ data });
      });
    })
    .catch(err => {
      if (!err instanceof APIError) {
        err = new APIError('Error updating Order', 500);
      }
      next(err);
    });
}

export default {
  load,
  get,
  create,
  update,
  // list,
  // remove,
};
