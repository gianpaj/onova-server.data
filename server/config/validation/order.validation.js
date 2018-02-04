import Joi from 'joi';

export default {
  // POST /api/orders
  create: {
    body: {
      product: Joi.string()
        // shortid
        .regex(/^[a-zA-Z0-9_-]{7,14}$/)
        .required(),
    },
  },

  // GET /api/orders/:orderId
  // PUT /api/orders/:orderId
  // DELETE /api/orders/:orderId
  orderId: {
    params: {
      orderId: Joi.string()
        .hex()
        .length(24)
        .required(),
    },
    body: {
      status: Joi.string().only([
        'pending',
        'purchased',
        'shipped',
        'completed',
        'cancelled',
      ]),
      // eslint-disable-next-line
      paymentMethod: Joi.string().only([
        'paypal',
        'liqpay'
      ]),
    },
  },
};
