import Joi from 'joi';

export default {
  // POST /api/orders
  create: {
    product: Joi.string()
      // shortid
      .regex(/^[a-zA-Z0-9_-]{7,14}$/)
      .required(),
  },

  // GET /api/orders/:orderId
  // PUT /api/orders/:orderId
  // DELETE /api/orders/:orderId
  orderId: {
    orderId: Joi.string()
      .hex()
      .length(24)
      .required(),
  },
};
