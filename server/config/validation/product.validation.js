import Joi from 'joi';
import validate from 'express-validation';

import validation from '../../helpers/validation';

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
            .regex(validation.hashtag)
            .min(1)
            .max(30)
        )
        .single(),
      description: Joi.string()
        .min(7)
        .max(300)
        .required(),
      price: Joi.string()
        .regex(validation.price)
        .invalid('0')
        .invalid('0.00')
        .required(),
      currency: Joi.string().valid('UAH'), // 'UAH' by default
      latitude: Joi.number()
        .min(-90)
        .max(90),
      longitude: Joi.number()
        .min(-180)
        .max(180),
    },
  },

  // GET /api/products/:uuid
  // DELETE /api/products/:uuid
  productUUIDParam: {
    params: {
      uuid: Joi.string()
        .regex(validation.shortid)
        .required(),
    },
  },

  // PUT /api/products/:uuid
  putProduct: {
    params: {
      uuid: Joi.string()
        .regex(validation.shortid)
        .required(),
    },
    body: {
      categoryIds: Joi.array()
        .unique()
        .max(5)
        .items(
          Joi.number()
            .min(0)
            .max(5)
        )
        .single(),
      typeIds: Joi.array()
        .unique()
        .max(5)
        .items(
          Joi.number()
            .min(0)
            .max(5)
        )
        .single(),
      tags: Joi.array() // optional,
        .max(30)
        .items(
          Joi.string()
            .regex(validation.hashtag)
            .min(1)
            .max(30)
        )
        .single(),
      description: Joi.string()
        .min(7)
        .max(300),
      price: Joi.string()
        .regex(validation.price)
        .invalid('0')
        .invalid('0.00'),
    },
  },

  // GET /api/products
  getProducts: {
    query: {
      limit: Joi.number()
        .min(1)
        .max(50),
      userid: Joi.string()
        .hex()
        .length(24),
      username: Joi.string()
        .min(3)
        .max(30),
      tags: Joi.array()
        .unique()
        .single()
        .items(
          Joi.string()
            .regex(validation.hashtag)
            .min(1)
            .max(30)
        )
        .max(10),
      lastId: Joi.string()
        .hex()
        .length(24),
    },
  },
};
