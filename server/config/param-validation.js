import Joi from 'joi';
import validate from 'express-validation';

import validation from '../helpers/validation';

// assign options
validate.options({
  allowUnknownBody: false,
  allowUnknownHeaders: false,
  allowUnknownQuery: false,
  allowUnknownParams: false,
  allowUnknownCookies: false,
});

export default {
  // POST /api/users
  createUser: {
    body: {
      username: Joi.string()
        .regex(validation.username)
        .min(3)
        .max(30)
        .required(),
      // displayName:  Joi.string().min(3).max(30).required(),
      mobileNumber: Joi.string().regex(validation.mobileNumber),
      emailAddress: Joi.string()
        .email()
        .required(),
      password: Joi.string()
        .min(8)
        .max(50)
        .required(),
    },
  },

  // UPDATE /api/users/:userId
  updateUser: {
    body: {
      bio: Joi.string().max(300),
      displayName: Joi.string()
        .min(3)
        .max(30),
      username: Joi.string()
        .regex(validation.username)
        .min(3)
        .max(30),
      mobileNumber: Joi.string().regex(validation.mobileNumber),
      emailAddress: Joi.string().email(),
      password: Joi.string()
        .min(8)
        .max(50),
      // temp - we are not validating month is valid, etc.
      last_four: Joi.string()
        .length(4)
        .regex(/^[0-9]+$/),
      exp_month: Joi.string()
        .length(2)
        .regex(/^[0-9]+$/),
      exp_year: Joi.string()
        .length(2)
        .regex(/^[0-9]+$/),
      shippingAddress: {
        firstName: Joi.string(),
        lastName: Joi.string(),
        company: Joi.string(),
        line1: Joi.string(),
        line2: Joi.string().empty(''),
        line3: Joi.string().empty(''),
        city: Joi.string(),
        state: Joi.string(),
        country: Joi.string(),
        postcode: Joi.string(),
      },
    },
    params: {
      userId: Joi.string()
        .hex()
        .required(),
    },
  },

  // POST /api/auth/login
  login: {
    body: {
      emailAddress: Joi.string()
        .email()
        .required(),
      password: Joi.string().required(),
    },
  },

  // GET /api/auth/activate/:token
  activate: {
    params: {
      token: Joi.string()
        .hex()
        .length(16)
        .required(),
    },
  },

  // POST /api/auth/reset
  requestReset: {
    body: {
      emailAddress: Joi.string()
        .email()
        .required(),
    },
  },

  // POST /api/auth/reset/:token
  resetForm: {
    params: {
      token: Joi.string()
        .hex()
        .length(16)
        .required(),
    },
    body: {
      password: Joi.string()
        .min(8)
        .max(50)
        .required(),
      passwordagain: Joi.string()
        .min(8)
        .max(50)
        .required(),
    },
  },

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

  productUUIDParam: {
    params: {
      uuid: Joi.string()
        // shortid
        .regex(/^[a-zA-Z0-9_-]{7,14}$/)
        .required(),
    },
  },

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
