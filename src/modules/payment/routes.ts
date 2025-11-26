import { Router } from 'express';
import PaymentController from './payment-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';

const router = Router();

router.post('/process', authMiddleware, PaymentController.processPayment);
router.post('/renew', authMiddleware, PaymentController.renewSubscription);
router.post('/upgrade', authMiddleware, PaymentController.upgradePlan);
router.post('/preview-change', authMiddleware, PaymentController.verifyPlanChange);
router.get('/status/:paymentId', authMiddleware, PaymentController.checkPaymentStatus);

export default router;