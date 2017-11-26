import express from 'express';
import validate from 'express-validation';
import passport from 'passport';
import multer from 'multer';

import paramValidation from '../config/param-validation';
import productCtrl from '../controllers/product.controller';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router(); // eslint-disable-line new-cap
const upload = multer({ storage: multer.memoryStorage() });

router
  .route('/')
  // GET /api/products - Get list of products 'forsale'
  // .get(productCtrl.list)

  // POST /api/products - Create new product
  .post(
    upload.array('photos', 5),
    validate(paramValidation.createProduct),
    productCtrl.create
  );

router
  .route('/:uuid')
  // GET /api/products/:uuid - Get product
  .get(productCtrl.get)

//   // PUT /api/products/:uuid - Update product
//   .put(requireAuth, productCtrl.update)

//   // DELETE /api/products/:uuid - Delete product - Protected route
//   .delete(requireAuth, productCtrl.remove);

// Load product when API with uuid route parameter is hit
// router.param('uuid', productCtrl.load);

export default router;
