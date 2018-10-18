import Joi from 'joi';

export default {
  // GET /api/shipping/departments/${city}
  departments: {
    params: {
      city: Joi.string().uuid(),
    },
  },
  // GET /api/shipping/costs
  costs: {
    query: {
      price: Joi.string().required(),
      weight: Joi.number().required(),
      senderOfficeID: Joi.string()
        .uuid()
        .required(),
      recipientOfficeID: Joi.string()
        .uuid()
        .required(),
    },
  },
};
