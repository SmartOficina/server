import { Router } from 'express';
import CouponController from './coupon-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';

const router = Router();

router.post('/validate', authMiddleware, CouponController.validateCoupon);
router.get('/plan/:code', authMiddleware, CouponController.getPlanForCoupon);

export default router;