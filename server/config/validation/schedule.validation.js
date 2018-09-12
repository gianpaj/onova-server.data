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
  // GET /api/schedule
  listSchedule: {},
  // POST /api/schedule
  createSchedule: {
    body: {
      categoryIds: validation.categoriesOrTypes.required(),
      // today
      date: Joi.date().min(new Date(new Date().setHours(0, 0, 0, 0))),
      typeIds: validation.categoriesOrTypes.required(),
      tags: validation.tags,
      description: validation.description.required(),
      photos: validation.photos.required(),
      price: validation.price.required(),
      currency: Joi.string().valid('UAH'), // 'UAH' by default
      // socials: Joi.array()
      //   .unique()
      //   .items(Joi.string().valid(['fb', 'vk']))
      //   .single()
      //   .required(),
      latitude: Joi.number()
        .min(-90)
        .max(90),
      longitude: Joi.number()
        .min(-180)
        .max(180),
    },
  },
};
