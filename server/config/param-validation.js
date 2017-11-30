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

import validation from '../helpers/validation';

export default {
  // POST /api/users
  createUser: {
    body: {
      username: Joi.string()
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
      username: Joi.string()
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
        .max(50),
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
      // photoURIs: Joi.array()
      //   .items(Joi.string())
      //   .required(),
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
      seller: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .length(24)
        .required(),
      price: Joi.string()
        .regex(/^\d+(\.\d{2})?$/)
        .required(),
      currency: Joi.string().valid('UAH'), // 'UAH' by default
    },
  },

  getProduct: {
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

  deleteProduct: {
    params: {
      uuid: Joi.string()
        // shortid
        .regex(/^[a-zA-Z0-9_-]{7,14}$/)
        .required(),
    },
  },
};
