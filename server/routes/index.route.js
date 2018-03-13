import express from 'express';

import authRoutes from './auth.route';
import commentRoutes from './comment.route';
import feedRoutes from './feed.route';
import followRoutes from './follow.route';
import orderRoutes from './order.route';
import productRoutes from './product.route';
import userRoutes from './user.route';

const router = express.Router();

// mount auth routes at /auth
router.use('/auth', authRoutes);

// GET /health-check - Check service health
router.get('/health-check', (req, res) => res.send('OK'));

// GET /health-check/json - Check service health with JSON return type
router.get('/health-check/json', (req, res) => res.json({ ok: true }));

// mount user routes at /users
// +
// mount user notifications routes at /users/notifications
router.use('/users', userRoutes);

// mount user follow routes at /users/:userId/[follow/unfollow]
router.use('/users', followRoutes);

// mount product routes at /products
router.use('/products', productRoutes);

// mount product routes at /products/:uuid/comment
router.use('/products', commentRoutes);

// mount orders routes at /orders
router.use('/orders', orderRoutes);

router.use('/feed', feedRoutes);

export default router;
