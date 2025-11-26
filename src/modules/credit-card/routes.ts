import { Router } from 'express';
import CardManagementController from './credit-card-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';

const router = Router();

router.get('/cards', authMiddleware, CardManagementController.listSavedCards);
router.post('/cards/set-default', authMiddleware, CardManagementController.setDefaultCard);
router.post('/cards/delete', authMiddleware, CardManagementController.deleteCard);

export default router;