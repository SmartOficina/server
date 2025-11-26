import { Router } from 'express';
import ClientsController from './clients-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';
import { Permission } from '../plans/permission-entity';
import { requirePermission } from '../../core/middleware/permission-middleware';

const router = Router();

router.post('/list', authMiddleware, ClientsController.listClients);
router.post('/create', authMiddleware, requirePermission(Permission.CLIENT_CREATE), ClientsController.createClient);
router.post('/edit', authMiddleware, requirePermission(Permission.CLIENT_EDIT), ClientsController.editClient);
router.post('/remove', authMiddleware, requirePermission(Permission.CLIENT_DELETE), ClientsController.removeClient);
router.post('/update-photo', authMiddleware, requirePermission(Permission.CLIENT_EDIT), ClientsController.updateClientPhoto);
router.post('/remove-photo', authMiddleware, requirePermission(Permission.CLIENT_EDIT), ClientsController.removeClientPhoto);

export default router;