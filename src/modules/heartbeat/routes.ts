import { Router } from 'express';
import HeartbeatController from './heartbeat-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';

const router = Router();

router.post('/ping', authMiddleware, HeartbeatController.sendHeartbeat);

export default router;