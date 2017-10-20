import Joi from 'joi';

import validation from '../server/helpers/validation';

export default {
  // POST /api/users
  createUser: {
    body: {
      username: Joi.string().required(),
      mobileNumber: Joi.string().regex(validation.mobileNumber),
      emailAddress: Joi.string().regex(validation.emailAddress).required(),
    }
  },

  // UPDATE /api/users/:userId
  updateUser: {
    body: {
      username: Joi.string().required(),
      mobileNumber: Joi.string().regex(validation.mobileNumber).required(),
      emailAddress: Joi.string().regex(validation.emailAddress).required()
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
  }
};
