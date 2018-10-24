// @flow

const debug = require('debug')('express-mongoose-es6-rest-api:index');

import axios from 'axios';
import httpStatus from 'http-status';

import APIError from '../helpers/APIError';
import Order, { OrderDoc } from '../models/order.model';
import Product, { ProductDoc } from '../models/product.model';
import User, { UserDoc } from '../models/user.model';
import Block from '../models/block.model';
import Notification from '../models/notification.model';
import notifCtrl from '../controllers/notification.controller';

import type { NotifPayload } from '../controllers/notification.controller';

import config from '../config/config';

axios.defaults.baseURL = config.UAPAY_BASE_URL;

const axiosConfig = {
  auth: {
    username: config.UAPAY_CLIENTID,
    password: config.UAPAY_KEY,
  },
};

declare class express$Request extends express$Request {
  order: OrderDoc;
  user: UserDoc;
}

const i18n = {
  orderPaid: 'Congrats! 🎉 You have a new purchase!', // 37 chars
  orderShipped: 'Your purchase has been shipped! 🎉', // 34 chars
  orderCancelled: 'Your order has been cancelled! 😭', // 33 chars
};

const ONOVA_RATE = 1; // 1 = 100% -- 0.1 = 10%
const UAPAY_PERC = 0.015; // 1.5%
const UAPAY_EXTRA = 10; // UAH

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
 * GET /api/orders/:orderId
 *
 * @property {*} req - Express request
 * @property {*} req.params - Express session parameters
 * @property {string} req.params.id - The id of the order.
 */
async function get(req: express$Request, res: express$Response) {
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
    .then(async (product: ProductDoc) => {
      if (!product) {
        throw new APIError('Product not found', 404);
      }

      if (req.user._id.toString() === product.seller._id.toString()) {
        throw new APIError(
          'You cannot buy your own items',
          httpStatus.BAD_REQUEST
        );
      }

      const order = await Order.findOne({
        buyer: req.user._id,
        product: product._id,
      });
      // FIXME: extend APIError to be able to send extra data
      if (order) {
        order.status = 'pending';
        order.save();
        await addProductToCheckout(product);
        throw { message: 'Duplicate order', order };
      }

      const blocking = await Block.countDocuments({
        $or: [{ targetUser: req.user._id }, { sourceUser: req.user._id }],
      });

      if (product.status !== 'forsale' || blocking > 0) {
        throw new APIError(
          'This product is not longer for sale or is reserved.',
          httpStatus.BAD_REQUEST
        );
      }
      return product;
    })
    .then(async product => {
      const pPrice = product.price.toString();
      const onovaFee = (parseFloat(pPrice) * ONOVA_RATE).toString();
      const transactionFee = product.price * UAPAY_PERC + UAPAY_EXTRA;

      const order = new Order({
        buyer: req.user._id,
        currency: product.currency, // 'UAH' by default
        // datePending // Date.now by default
        onovaFee,
        priceOfItem: product.price,
        product: product._id,
        seller: product.seller._id,
        transactionFee,
        // status // 'pending' by default
      });

      await addProductToCheckout(product);
      return order.save();
    })
    .then(savedOrder =>
      res.status(httpStatus.CREATED).json({ data: savedOrder })
    )
    .catch(e => {
      if (e.message === 'Duplicate order') {
        return res
          .status(httpStatus.BAD_REQUEST)
          .json({ message: e.message, data: e.order });
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
async function update(
  req: session$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { archive, reason, status: newStatus } = req.body;

  const iAmTheSeller =
    req.user._id.toString() == req.order.seller._id.toString();

  const foundOrder = req.order;

  try {
    // can go only from either 'paid' or 'pending' -> 'cancelled'
    if (
      ['paid', 'pending'].indexOf(foundOrder.status) < 0 &&
      newStatus === 'cancelled'
    ) {
      throw new APIError(
        'cannot cancel an order that has been shipped or completed',
        httpStatus.BAD_REQUEST
      );
    }

    if (foundOrder.status === 'cancelled' && newStatus !== 'cancelled') {
      throw new APIError(
        'cannot change the status of an order once is cancelled',
        httpStatus.BAD_REQUEST
      );
    }

    // TODO: do with Joi in order.validation.js
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
    // if (foundOrder.status === 'pending' && newStatus === 'completed') {
    //   throw new APIError('cannot complete an order that is pending', 400);
    // }

    // TODO: move this to a function that changes the state and keeps a transition log
    // // can go only from either 'pending' -> 'paid'
    // if (
    //   ['shipped', 'completed'].indexOf(foundOrder.status) > -1 &&
    //   newStatus === 'paid'
    // ) {
    //   throw new APIError(
    //     'cannot set an order status to paid if its not pending first',
    //     400
    //   );
    // }

    if (newStatus === 'confirmed') {
      if (foundOrder.status !== 'paid') {
        throw new APIError('cannot confirm an order that is not paid', 400);
      }
      // only the seller can confirm the order
      if (!iAmTheSeller) {
        throw new APIError('Unauthorized', httpStatus.UNAUTHORIZED);
      }

      // TODO: call function to make API request to UAPAY

      foundOrder.dateConfirmed = new Date();
      await Product.updateOne({ _id: foundOrder.product }, { status: 'sold' });
      // TODO: remove from checkout as well
    }
  } catch (err) {
    return next(err);
  }

  if (newStatus === 'cancelled') {
    // the seller is required to enter a reason
    if (!reason && iAmTheSeller) {
      const err = new APIError('"reason" is required', httpStatus.BAD_REQUEST);
      return next(err);
    }
    if (iAmTheSeller) {
      foundOrder.reason = reason;
    }

    if (
      foundOrder.transactionId &&
      (foundOrder.status === 'paid' ||
        foundOrder.transactionStatus == 'ua-pending')
    ) {
      await axios.post(
        `/deals/${foundOrder.transactionId}/rejections`,
        null,
        axiosConfig
      );
      foundOrder.transactionStatus = 'ua-reversed';
    }

    foundOrder.dateCancelled = new Date();
    await removeProductToCheckout(foundOrder.product._id);
  }

  foundOrder.status = newStatus ? newStatus : foundOrder.status;
  foundOrder.paymentMethod = req.body.paymentMethod
    ? req.body.paymentMethod
    : foundOrder.paymentMethod;

  if (newStatus) {
    createOrderNotification(foundOrder, iAmTheSeller)
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
 * Start payment via UAPAY
 *
 * POST /api/orders/:orderId/pay
 *
 * @property {*} req.query - Express query parameters
 * @property {MongoId} req.query.orderId
 * @property {*} req.body - Express body parameters
 * @property {string} req.body.cvc - The CVC of the payer (buyer) payment card
 */
async function pay(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { order } = req;

  try {
    if (isNaN(parseInt(req.body.cvc)))
      throw new APIError('Invalid CVC', httpStatus.BAD_REQUEST);

    if (order.status !== 'pending')
      throw new APIError(
        `Cannot pay an order that\'s ${order.status}`,
        httpStatus.BAD_REQUEST
      );

    const product = await Product.findOne({ _id: order.product });

    if (!product)
      throw new APIError('Product not found.', httpStatus.NOT_FOUND);

    const payment = await createPaymentUAPAY(order, product, req.body.cvc);

    // TODO: check transaction hasn't already started
    order.transactionStatus = 'ua-pending';

    res.status(httpStatus.CREATED).json({ data: { order, payment } });
  } catch (err) {
    if (err.response && err.response.data) console.error(err.response.data);
    if (!(err instanceof APIError)) {
      console.error(err);
      err = new APIError(
        'Error creating payment',
        httpStatus.INTERNAL_SERVER_ERROR
      );
    }
    next(err);
  }
}

function createPaymentUAPAY(
  order: OrderDoc,
  product: ProductDoc,
  cvc: string
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const buyer = await User.findById(order.buyer);
      const seller = await User.findById(order.seller);

      // Step 1 - Create cart
      const {
        data: { data: cart },
      } = await axios.post('/carts', null, axiosConfig); // no data necessary

      // Step 2 - Create Deal
      const {
        data: { data: deal },
      } = await axios.post(
        '/deals',
        {
          cartId: cart.id,
          productTitle: product.description,
          productWeight: product.weight, // number
          productPrice: product.price.toString().replace('.', ''), // to number in cents
          sellerFirstName: seller.shippingAddress.firstName,
          sellerLastName: seller.shippingAddress.lastName,
          sellerPatronymic: '', // seller.shippingAddress.fathersName
          sellerPhone: '38' + seller.mobileNumber, // needs to start with 380 e,g. 380 97 741 4301 (no spaces)
          sellerEmail: seller.emailAddress,
          buyerFirstName: buyer.shippingAddress.firstName,
          buyerLastName: buyer.shippingAddress.lastName,
          buyerPatronymic: '', // buyer.shippingAddress.fathersName
          buyerPhone: '38' + buyer.mobileNumber,
          buyerEmail: buyer.emailAddress,
          lg: 'uk',
          payment: {
            type: 'P2P_ONOVA',
            cardToId: seller.paymentInfo.card_token,
          },
          handler: {
            type: 'NovaPoshta_ONOVA',
            senderFirstName: seller.shippingAddress.firstName,
            senderLastName: seller.shippingAddress.lastName,
            senderPatronymic: '',
            senderPhone: '38' + seller.mobileNumber,
            senderEmail: seller.emailAddress,
            senderCityId: seller.shippingAddress.city,
            senderOfficeId: seller.shippingAddress.departmentNovaposhta,
            recipientFirstName: buyer.shippingAddress.firstName,
            recipientLastName: buyer.shippingAddress.lastName,
            recipientPatronymic: '', // buyer.shippingAddress.fathersName
            recipientPhone: '38' + buyer.mobileNumber,
            recipientEmail: buyer.emailAddress,
            recipientCityId: buyer.shippingAddress.city,
            recipientOfficeId: buyer.shippingAddress.departmentNovaposhta,
          },
        },
        axiosConfig
      );

      order.transactionId = deal.id;
      order.save();

      // Step 3 - Start payment
      await axios.post(
        `/deals/${deal.id}/payments`,
        {
          remoteIP: '127.0.0.1', // Payer IP Address?
          card: {
            id: buyer.paymentInfo.card_token,
            securityCode: cvc,
          },
        },
        axiosConfig
      );

      // wait few secs?
      // Step 4 - Get deal info to send form details to client
      let retryNum = 0;
      let newDeal;
      do {
        retryNum++;
        const {
          data: { data },
        } = await axios.get(`/deals/${deal.id}`, axiosConfig);
        newDeal = data;
        // console.log(newDeal.productPayment.waitingFor);
        await sleep(500);
      } while (
        newDeal.productPayment.waitingFor === 'PAY_PROCESSING' &&
        retryNum < 7
      );

      // console.log(newDeal);
      // TODO check commissionAmount is equal to agreed
      if (
        // newDeal.productPayment.amount == product.product.toString().replace('.', '') &&
        newDeal.productPayment.type === 'P2P_ONOVA' &&
        newDeal.productPayment.statusCode === 'NEEDS_CONFIRMATION'
      ) {
        const { confirmation } = newDeal.productPayment.details;
        resolve({
          redirectUrl: confirmation.redirectUrl,
          PaReq: confirmation.form.PaReq,
        });
      } else {
        reject(newDeal);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get payment from UAPAY. Used after client makes payment with UAPAY
 *
 * GET /api/orders/:orderId/paymentStatus
 *
 * @property {*} req.query - Express query parameters
 * @property {MongoId} req.query.orderId
 */
async function paymentStatus(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { order } = req;

  try {
    if (!order.transactionId) {
      return res.json({
        data: {
          rawStatus: 'none',
          status: 'none',
        },
      });
    }

    const {
      data: { data },
    } = await axios.get(`/deals/${order.transactionId}`, axiosConfig);

    switch (data.productPayment.status) {
      // payment not yet created
      case 'NEW':
        order.transactionStatus = 'ua-pending';
        // The buyer needs to confirmation the transaction entering the 3DS code (LOOKUP works?)
        if (data.productPayment.statusCode === 'NEEDS_CONFIRMATION')
          order.transactionStatus = 'ua-needsconfirmation';
        break;
      case 'PAID':
        // check needed because payment status is still PAID if deal has been confirmed
        if (data.status !== 'PAID') break;
        order.transactionStatus = 'ua-finished';
        order.status = 'paid';
        // only update first time we check
        if (!order.datePaid) order.datePaid = new Date();
        createOrderNotification(order)
          .then(() => {
            debug('notification(s) created for order:', 'paid');
          })
          .catch(e => console.error(e));
        break;
      // The bank has not been able to make debit for technical reasons
      case 'REJECTED':
        order.transactionStatus = 'ua-rejected';
        break;
      // The payment was returned to the sender's card
      case 'REVERSED':
        order.transactionStatus = 'ua-reversed';
        order.status = 'cancelled';
        if (!order.dateCancelled) order.dateCancelled = new Date();
        break;

      default:
        break;
    }
    order.save();

    // if (data.productPayment.type === 'P2P_ONOVA')

    res.json({
      data: {
        rawStatus: data.productPayment.statusCode,
        status: order.transactionStatus,
      },
    });
  } catch (error) {
    if (!(error instanceof APIError)) {
      console.error(error);
      error = new APIError(
        'Error getting payment status',
        httpStatus.INTERNAL_SERVER_ERROR
      );
    }
    next(error);
  }
}

/**
 * Creates the approprate notification(s) for each order status transition
 *
 * See graph in `ORDER_PROCESS.md`
 */
async function createOrderNotification(
  order: OrderDoc,
  iAmTheSeller?: boolean
) {
  let notif: NotifPayload = {
    data: order,
    triggeredBy: order._id,
    triggeredType: 'Order',
  };
  switch (order.status) {
    case 'confirmed':
      // seller can ship item.
      // TODO: send 2 notifications
      return Promise.resolve();
    case 'paid':
      // check if notification already exists
      const notifExists = await Notification.findOne({
        triggeredBy: order._id,
        targetUser: order.seller._id,
        sourceUser: order.buyer._id,
        'data.status': 'paid',
      });
      if (notifExists) return Promise.resolve();
      // seller needs to confirm order after receiving a notification and opening the 'confirmOrder' screen on mobile app
      notif = {
        ...notif,
        notifI18n: i18n.orderPaid,
        targetUser: order.seller._id,
        sourceUser: order.buyer._id,
      };
      break;

    case 'shipped':
      // notify the buyer
      // TODO: test
      notif = {
        ...notif,
        notifI18n: i18n.orderShipped,
        targetUser: order.buyer._id,
        sourceUser: order.seller._id,
      };
      break;

    case 'cancelled':
      if (!iAmTheSeller) return Promise.resolve();
      // cancelled by seller. there is no notification if the buyer cancels
      notif = {
        ...notif,
        notifI18n: i18n.orderCancelled,
        targetUser: order.buyer._id,
        sourceUser: order.seller._id,
      };
      break;
  }
  return notifCtrl.createNotification(notif);
}

function addProductToCheckout(product) {
  // const doc = new Checkout({ product });
  // doc.save();
  product.status = 'reserved';
  return product.save();
}

function removeProductToCheckout(productId: string) {
  // Checkout.find({ product: productId });
  return Product.updateOne({ _id: productId }, { status: 'forsale' });
}

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export default {
  load,
  get,
  create,
  update,
  list,
  pay,
  paymentStatus,
};
