import express from 'express';
import userRoutes from './user.route';
import productRoutes from './product.route';
import authRoutes from './auth.route';

const router = express.Router(); // eslint-disable-line new-cap

// GET /health-check - Check service health
router.get('/health-check', (req, res) => res.send('OK'));

// GET /health-check/json - Check service health with JSON return type
router.get('/health-check/json', (req, res) => res.json({ ok: true }));

// mount user routes at /users
router.use('/users', userRoutes);

// mount user routes at /product
router.use('/products', productRoutes);

// mount auth routes at /auth
router.use('/auth', authRoutes);

export default router;
