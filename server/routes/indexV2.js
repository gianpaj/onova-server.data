import express from 'express';

import dropRoutes from './drop.route';

const router = express.Router();

router.use('/drop', dropRoutes);

export default router;
