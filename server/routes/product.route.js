import express from 'express';
import validate from 'express-validation';
import passport from 'passport';
import multer from 'multer';
import path from 'path';
import httpStatus from 'http-status';

import paramValidation from '../config/param-validation';
import APIError from '../helpers/APIError';
import productCtrl from '../controllers/product.controller';

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router(); // eslint-disable-line new-cap

/**
 * Authorization Required middleware.
 */
function isAuthorized(req, res, next) {
  if (req.user._id.toString() !== req.product.seller._id.toString()) {
    const err = new APIError('Unauthorized', 401);
    return next(err);
  }
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpg|jpeg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }

    const APIerr = new APIError(
      // prettier-ignore
      `Error: File upload only supports the following filetypes: ${filetypes}`,
      httpStatus.BAD_REQUEST
    );
    return cb(APIerr);
  },
});

router
  .route('/')
  // GET /api/products - Get list of products 'forsale'
  .get(validate(paramValidation.getProducts), productCtrl.list)

  // POST /api/products - Create new product
  .post(
    upload.array('photos', 6),
    validate(paramValidation.createProduct),
    requireAuth,
    productCtrl.create
  );

router
  .route('/:uuid')
  // GET /api/products/:uuid - Get product
  .get(validate(paramValidation.productUUIDParam), productCtrl.get)

  // PUT /api/products/:uuid - Update product
  .put(
    validate(paramValidation.productUUIDParam),
    requireAuth,
    isAuthorized,
    productCtrl.update
  )

  // DELETE /api/products/:uuid - Delete product - Protected route
  .delete(
    validate(paramValidation.productUUIDParam),
    requireAuth,
    isAuthorized,
    productCtrl.remove
  );

// Load product when API with uuid route parameter is hit
router.param('uuid', productCtrl.load);

export default router;
