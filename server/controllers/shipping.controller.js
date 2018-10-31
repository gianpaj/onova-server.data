// @flow

import axios from 'axios';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

import Order, { OrderDoc } from '../models/order.model';

import APIError from '../helpers/APIError';
import config from '../config/config';
import User, { UserDoc } from '../models/user.model';

axios.defaults.baseURL = config.UAPAY_BASE_URL;

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
 * Get list of cities for Nova Poshta
 *
 * GET /api/shipping/cities
 */
function cities(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  Cities.find({}, { _id: 0, uk: 1, id: 1 })
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
 * Calculate the shipping costs with Nova Poshta (UAPAY API)
 *
 * GET /api/shipping/costs
 *
 * @property {*} req.query - Express query parameters
 * @property {number} req.query.price
 * @property {number} req.query.weight
 * @property {number} req.query.recipientOfficeID
 * @property {number} req.query.orderId
 */
async function costs(
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) {
  const { recipientOfficeID, orderId, price, weight } = req.query;
  try {
    const recipientDeparment: Deparment = await Deparment.findOne({
      id: recipientOfficeID,
    });
    const order: OrderDoc = await Order.findById(orderId);

    if (!recipientDeparment || !order) {
      throw new APIError('Error retrieving the deparment(s)');
    }

    const seller: UserDoc = await User.findById(order.seller);
    const { shippingAddress: Sship } = seller;

    if (!Sship.city || !Sship.departmentNovaposhta)
      throw new Error('Seller is missing payment or shipping info');

    const provider = await axios.get('/handlers/NovaPoshta_ONOVA/costs', {
      params: {
        productWeight: weight,
        productPrice: parseInt(price.replace('.', '')), // TODO: convert price properly to number
        senderOfficeId: Sship.departmentNovaposhta,
        senderCityId: Sship.city,
        recipientOfficeId: recipientDeparment.id,
        recipientCityId: recipientDeparment.cityID,
      },
      auth: {
        username: config.UAPAY_CLIENTID,
        password: config.UAPAY_KEY,
      },
    });

    if (!provider || !provider.data)
      throw new APIError('Error getting the costs from UAPAY');

    res.json({ data: provider.data.data.handlerPrice });
  } catch (error) {
    if (error.response && error.response.data)
      console.error(error.response.data);
    if (!(error instanceof APIError)) {
      return next(
        new APIError(
          'Error calculating shipping costs',
          httpStatus.SERVICE_UNAVAILABLE
        )
      );
    }
    next(error);
  }
}

/**
 * Get list of departments of Nova Poshta for a city
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
  Deparment.find({ cityID: req.params.city }, { _id: 0, uk: 1, id: 1 })
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
  costs,
  departments,
};
