import { Router } from 'express';
import VehiclesController from './vehicles-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';
import { requirePermission } from '../../core/middleware/permission-middleware';
import { Permission } from '../plans/permission-entity';

const router = Router();

router.post('/list', authMiddleware, VehiclesController.listVehicles);
router.post('/create', authMiddleware, requirePermission(Permission.VEHICLE_CREATE), VehiclesController.createVehicle);
router.post('/edit', authMiddleware, requirePermission(Permission.VEHICLE_EDIT), VehiclesController.editVehicle);
router.post('/remove', authMiddleware, requirePermission(Permission.VEHICLE_DELETE), VehiclesController.removeVehicle);
router.get('/info/:licensePlate', authMiddleware, VehiclesController.getVehicleInfo);

export default router;