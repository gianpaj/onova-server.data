import Joi from 'joi';

import validation from '../helpers/validation';

export default {
  // POST /api/users
  createUser: {
    body: {
      username:     Joi.string().min(3).max(30).required(),
      // displayName:  Joi.string().min(3).max(30).required(),
      mobileNumber: Joi.string().regex(validation.mobileNumber),
      emailAddress: Joi.string().email().required(),
      password:     Joi.string().min(8).max(50).required(),
    }
  },

  // UPDATE /api/users/:userId
  updateUser: {
    body: {
      username:     Joi.string().min(3).max(30).required(),
      // displayName:  Joi.string().min(3).max(30).required(),
      mobileNumber: Joi.string().regex(validation.mobileNumber),
      emailAddress: Joi.string().email().required(),
      password:     Joi.string().min(8).max(50),
    },
    params: {
      userId: Joi.string().hex().required()
    }
  },

  // POST /api/auth/login
  login: {
    body: {
      emailAddress: Joi.string().email().required(),
      password: Joi.string().required()
    }
  },

  // GET /api/auth/activate/:token
  activate: {
    params: {
      token: Joi.string().hex().length(16).required()
    }
  },

  // POST /api/auth/reset
  requestReset: {
    body: {
      emailAddress: Joi.string().email().required(),
    }
  },

  // POST /api/auth/reset/:token
  resetForm: {
    params: {
      token: Joi.string().hex().length(16).required()
    },
    body: {
      password:       Joi.string().min(8).max(50).required(),
      passwordagain:  Joi.string().min(8).max(50).required(),
    }
  }
  },

  // POST /api/products
  createProduct: {
    body: {
      // photoURIs: Joi.array()
      //   .items(Joi.string())
      //   .required(),
      categoryIds: Joi.array()
        .items(Joi.number())
        .required(),
      typeIds: Joi.array()
        .items(Joi.number())
        .required(),
      tags: Joi.array().items(Joi.string().length(24)), // optional
      description: Joi.string()
        .min(7)
        .max(300)
        .required(),
      seller: Joi.string()
        // .min(3)
        .length(24)
        .required(),
      price: Joi.number().required(),
      currency: Joi.string().valid('UAH'), // 'UAH' by default
    },
  },
};
