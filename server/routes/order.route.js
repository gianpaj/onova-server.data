// @flow

import express from 'express';
import validate from 'express-validation';
import passport from 'passport';

import paramValidation from '../config/validation/order.validation';
import orderCtrl from '../controllers/order.controller';

const requireAuth = passport.authenticate('jwt', { session: false });

const router = express.Router();

// ALL Protected routes
router
  .route('/')
  // // GET /api/orders - Get list of orders of the user who requested (via JWT)
  // .get(requireAuth, orderCtrl.list)

  // POST /api/orders - Create new order
  .post(validate(paramValidation.create), requireAuth, orderCtrl.create);

router
  .route('/:orderId')
  // GET /api/orders/:orderId - Get a single order
  .get(validate(paramValidation.orderId), requireAuth, orderCtrl.get)

  // // PUT /api/orders/:orderId - Update order
  // .put(validate(paramValidation.orderId), requireAuth, orderCtrl.update)

  // // DELETE /api/orders/:orderId - Delete order
  // .delete(validate(paramValidation.orderId), requireAuth, orderCtrl.remove);

// Load user when API with orderId route parameter is hit
router.param('orderId', orderCtrl.load);

export default router;
