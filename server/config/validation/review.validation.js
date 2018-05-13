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
  // GET & POST /api/users/:userId/review
  userIdParam: {
    params: {
      userId: Joi.string()
        .hex()
        .length(24)
        .required(),
    },
    query: {
      as: Joi.string()
        .valid(['buyer', 'seller', 'both'])
        .default('both'),
    },
  },
  // POST /api/users/:userId/review
  createReview: {
    body: {
      orderId: Joi.string()
        .hex()
        .length(24)
        .required(),
      text: Joi.string()
        .min(7)
        .max(200),
      rateNumber: Joi.number()
        .min(1)
        .max(5),
      lang: Joi.string()
        .valid(['uk', 'en'])
        .required(),
      trackingNumber: Joi.string()
        .length(14)
        .required(),
    },
  },
};
