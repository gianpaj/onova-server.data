// @flow

import APIError from '../helpers/APIError';
import Order, { OrderDoc } from '../models/order.model';
import Product, { ProductDoc } from '../models/product.model';
import User, { UserDoc } from '../models/user.model';
import config from '../config/config';

declare class express$Request extends express$Request {
  order: OrderDoc;
}

const ONOVA_RATE = 1; // 1 = 0 % -- 1.2 = 20%

/**
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
 * GET /api/orders/:uuid - Get order
 *
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
 * @property {bson$ObjectId} req.body.product - uuid
 */
function create(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  if (req.user.accountStatus !== 'verified') {
    throw new APIError(
      'Please verify your account before buying a product',
      400
    );
  }

  Product.findOne({ uuid: req.body.product })
    .then(product => {
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
      return User.findById(req.user._id)
        .then(seller => {
          if (!seller) {
            throw new APIError('Seller not found', 400);
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
            seller: seller._id,
            // status // 'pending' by default
          });

          return order
            .save()
            .then(savedOrder => savedOrder)
            .catch((e) => {
              console.error(e);
              throw new APIError('Error creating Order', 400);
            });
        })
        .then(savedOrder => {
          return res.status(201).json({ data: savedOrder });
        });
    })
    .catch(e => next(e));
}

export default {
  load,
  get,
  create,
  // update,
  // list,
  // remove,
};
