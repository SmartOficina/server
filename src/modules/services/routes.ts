import { Router } from 'express';
import ServicesController from './services-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';
import { Permission } from '../plans/permission-entity';
import { requirePermission } from '../../core/middleware/permission-middleware';

const router = Router();

router.post('/list', authMiddleware, ServicesController.listServices);
router.post('/create', authMiddleware, requirePermission(Permission.SERVICE_CREATE), ServicesController.createService);
router.post('/edit', authMiddleware, requirePermission(Permission.SERVICE_EDIT), ServicesController.editService);
router.post('/remove', authMiddleware, requirePermission(Permission.SERVICE_DELETE), ServicesController.removeService);

export default router;