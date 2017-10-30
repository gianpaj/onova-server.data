import Joi from 'joi';

import validation from '../server/helpers/validation';

export default {
  // POST /api/users
  createUser: {
    body: {
      username:     Joi.string().min(3).max(30).required(),
      displayName:  Joi.string().min(3).max(30).required(),
      mobileNumber: Joi.string().regex(validation.mobileNumber),
      emailAddress: Joi.string().email().required(),
      password:     Joi.string().min(8).max(50).required(),
    }
  },

  // UPDATE /api/users/:userId
  updateUser: {
    body: {
      username: Joi.string().required(),
      // displayName:  Joi.string().min(3).max(30).required(),
      mobileNumber: Joi.string().regex(validation.mobileNumber).required(),
      emailAddress: Joi.string().email().required()
    },
    params: {
      userId: Joi.string().hex().required()
    }
  },

  // POST /api/auth/login
  login: {
    body: {
      emailAddress: Joi.string().required(),
      password: Joi.string().required()
    }
  },

  // GET /api/auth/activate/:token
  activate: {
    params: {
      token: Joi.string().hex().min(16).max(16).required()
    }
  }
};
