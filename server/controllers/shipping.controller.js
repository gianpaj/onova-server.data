// @flow

import httpStatus from 'http-status';
import mongoose from 'mongoose';

import APIError from '../helpers/APIError';

const CitiesSchema = new mongoose.Schema(
  { id: String, uk: String },
  { collection: 'cities' }
);

const Cities = mongoose.model('cities', CitiesSchema);

const DepartmentsSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  uk: {
    type: String,
    required: true,
    index: true,
  },
  maxWeight: Number,
  cityID: {
    type: String,
    required: true,
    index: true,
  },
});

const Deparment = mongoose.model('departments', DepartmentsSchema);

/**
 * Get list of cities for Nova Poshta (cached from UAPAY)
 *
 * GET /api/shipping/cities
 */
function cities(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  Cities.find()
    .then(cities => {
      if (!cities.length) {
        throw new Error('Error getting cities');
      }
      res.json({ data: cities });
    })
    .catch(error => {
      console.error(error);
      next(
        new APIError(
          'Error getting list of cities from UAPAY NovaPoshta',
          httpStatus.SERVICE_UNAVAILABLE
        )
      );
    });
}

/**
 * Get list of departments of Nova Poshta for a city (cached from UAPAY)
 *
 * GET /api/shipping/departments/${city}
 *
 * @property {*} req - express session
 * @property {*} req.params - express session parameters
 * @property {MongoId} req.params.city
 */
async function departments(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  Deparment.find({ cityID: req.params.city })
    .then(departments => {
      if (!departments.length) {
        throw new Error('Error getting departments');
      }
      res.json({ data: departments });
    })
    .catch(error => {
      next(
        new APIError(
          'Error getting list of departments from UAPAY NovaPoshta',
          httpStatus.SERVICE_UNAVAILABLE
        )
      );
    });
}

export default {
  cities,
  departments,
};
