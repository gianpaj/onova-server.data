import Joi from 'joi';

export default {
  // GET /api/shipping/departments/${city}
  departments: {
    params: {
      city: Joi.string(), // TODO: validate it's a UUID (8d5a980d-391c-11dd-90d9-001a92567626)
    },
  },
  // GET /api/shipping/costs
  costs: {
    query: {
      price: Joi.string().required(),
      weight: Joi.number().required(),
      senderOfficeID: Joi.string().required(),
      recipientOfficeID: Joi.string().required(),
    },
  },
};
