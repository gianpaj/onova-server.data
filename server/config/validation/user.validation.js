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
  // GET /api/users (for mentions)
  listUsers: {
    query: {
      u: Joi.string()
        .regex(validation.username)
        .min(0)
        .max(30),
      limit: Joi.number()
        .min(1)
        .max(50),
    },
  },

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
      pushToken: Joi.string(),
      platform: Joi.string().valid(['android', 'ios']),
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
      pushToken: Joi.string(),
      platform: Joi.string().valid(['android', 'ios']),
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
        fathersName: Joi.string(),
        departmentNovaposhta: Joi.string(),
        company: Joi.string(),
        line1: Joi.string(),
        line2: Joi.string().empty(''),
        line3: Joi.string().empty(''),
        city: Joi.string(),
        state: Joi.string(),
        country: Joi.string(),
        postcode: Joi.string(),
      },
      facebook: Joi.string(),
      increaseShare: Joi.boolean(),
      accessToken: Joi.string().when('facebook', {
        is: Joi.exist(),
        then: Joi.required(),
      }),
    },
    params: {
      userId: Joi.string()
        .hex()
        .length(24)
        .required(),
    },
  },
  notif: {
    query: {
      limit: Joi.number()
        .min(1)
        .max(50),
      lastId: Joi.string()
        .hex()
        .length(24),
    },
  },
};
