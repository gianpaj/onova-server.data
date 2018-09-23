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
  listSchedule: {
    username: validation.username,
  },
  // POST /api/schedule
  createSchedule: {
    body: {
      categoryIds: validation.categoriesOrTypes.required(),
      // today
      currency: Joi.string().valid('UAH'), // 'UAH' by default
      date: Joi.date().min(new Date(new Date().setHours(0, 0, 0, 0))),
      description: validation.description.required(),
      dropId: validation.objectId.required(),
      latitude: Joi.number()
        .min(-90)
        .max(90),
      longitude: Joi.number()
        .min(-180)
        .max(180),
      photos: validation.photos.required(),
      price: validation.price.required(),
      // socials: Joi.array()
      //   .unique()
      //   .items(Joi.string().valid(['fb', 'vk']))
      //   .single()
      //   .required(),
      tags: validation.tags,
      typeIds: validation.categoriesOrTypes.required(),
    },
  },
};
