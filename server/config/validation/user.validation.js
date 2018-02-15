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
  // POST /api/users
  createUser: {
    body: {
      username: Joi.string()
        .regex(validation.username)
        .min(3)
        .max(30)
        .required(),
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
        .length(24)
        .required(),
    },
  },
};
