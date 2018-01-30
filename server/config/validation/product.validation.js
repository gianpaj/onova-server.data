import Joi from 'joi';
import validate from 'express-validation';

// assign options
validate.options({
  allowUnknownBody: false,
  allowUnknownHeaders: false,
  allowUnknownQuery: false,
  allowUnknownParams: false,
  allowUnknownCookies: false,
});

export default {
  // POST /api/products
  createProduct: {
    body: {
      categoryIds: Joi.array()
        .unique()
        .max(5)
        .items(
          Joi.number()
            .min(0)
            .max(5)
        )
        .single()
        .required(),
      typeIds: Joi.array()
        .unique()
        .max(5)
        .items(
          Joi.number()
            .min(0)
            .max(5)
        )
        .single()
        .required(),
      tags: Joi.array() // optional,
        .max(30)
        .items(
          Joi.string()
            .regex(/^(\b[a-z][a-z0-9]*)$/i)
            .min(3)
            .max(30)
        )
        .single(),
      description: Joi.string()
        .min(7)
        .max(300)
        .required(),
      price: Joi.string()
        .regex(/^\d+(\.\d{2})?$/)
        .invalid('0')
        .invalid('0.00')
        .required(),
      currency: Joi.string().valid('UAH'), // 'UAH' by default
    },
  },

  // GET /api/products/:uuid
  // PUT /api/products/:uuid
  // DELETE /api/products/:uuid
  productUUIDParam: {
    params: {
      uuid: Joi.string()
        // shortid
        .regex(/^[a-zA-Z0-9_-]{7,14}$/)
        .required(),
    },
  },

  // GET /api/products
  getProducts: {
    query: {
      limit: Joi.number()
        .min(1)
        .max(50),
      skip: Joi.number()
        .min(1)
        .max(50),
      userid: Joi.string()
        .hex()
        .length(24),
      tags: Joi.array()
        .single()
        .items(
          Joi.string()
            .regex(/^(\b[a-z][a-z0-9]*)$/i)
            .min(3)
            .max(30)
        )
        .max(10),
    },
  },
};
