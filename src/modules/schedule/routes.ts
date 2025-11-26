import { Router } from 'express';
import ScheduleController from './schedule-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';
import { Permission } from '../plans/permission-entity';
import { requirePermission } from '../../core/middleware/permission-middleware';

const router = Router();

router.post('/list', authMiddleware, ScheduleController.listEvents);
router.post('/create', authMiddleware, requirePermission(Permission.SCHEDULE_CREATE), ScheduleController.createEvent);
router.post('/update', authMiddleware, requirePermission(Permission.SCHEDULE_EDIT), ScheduleController.updateEvent);
router.post('/remove', authMiddleware, requirePermission(Permission.SCHEDULE_DELETE), ScheduleController.removeEvent);
router.post('/status/update', authMiddleware, ScheduleController.updateEventStatus);

export default router;