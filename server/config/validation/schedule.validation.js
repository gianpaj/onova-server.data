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
  // POST /api/schedule
  createSchedule: {
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
      date: Joi.date().min('now'),
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
      photos: Joi.array()
        .unique()
        .max(6)
        .items(Joi.string())
        .single()
        .required(),
      price: Joi.string()
        .regex(validation.price)
        .invalid('0')
        .invalid('0.00')
        .required(),
      currency: Joi.string().valid('UAH'), // 'UAH' by default
      socials: Joi.array()
        .unique()
        .items(Joi.string().valid(['fb', 'vk']))
        .single()
        .required(),
    },
  },
};
