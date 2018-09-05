import Joi from 'joi';

import validation from '../../helpers/validation';

export default {
  // POST /api/orders
  create: {
    body: {
      product: Joi.string()
        .regex(validation.shortid)
        .required(),
    },
  },

  // GET /api/orders/:orderId
  // PUT /api/orders/:orderId
  orderId: {
    params: {
      orderId: Joi.string()
        .hex()
        .length(24)
        .required(),
    },
    body: {
      archive: Joi.boolean(),
      status: Joi.valid(['confirmed', 'cancelled']),
      reason: Joi.string()
        .min(10)
        .max(300),
      // eslint-disable-next-line
      paymentMethod: Joi.string().only(['paypal', 'liqpay']),
    },
  },
};
