import Joi from 'joi';

export default {
  // GET /api/shipping/departments/${city}
  departments: {
    city: Joi.string(), // TODO: Validate cities
  },
};
