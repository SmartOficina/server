import { Router } from 'express';
import ServiceOrdersController from './service-orders-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';
import { requirePermission } from '../../core/middleware/permission-middleware';
import { Permission } from '../plans/permission-entity';

const router = Router();

router.post('/list', authMiddleware, ServiceOrdersController.listServiceOrders);
router.get('/:id', authMiddleware, requirePermission(Permission.SERVICE_ORDER_VIEW), ServiceOrdersController.getServiceOrderById);
router.post('/create', authMiddleware, requirePermission(Permission.SERVICE_ORDER_CREATE), ServiceOrdersController.createServiceOrder);
router.post('/edit', authMiddleware, requirePermission(Permission.SERVICE_ORDER_EDIT), ServiceOrdersController.updateServiceOrder);
router.post('/remove', authMiddleware, requirePermission(Permission.SERVICE_ORDER_DELETE), ServiceOrdersController.removeServiceOrder);

router.post('/budget/approve', authMiddleware, ServiceOrdersController.approveBudget);
router.post('/budget/reject', authMiddleware, ServiceOrdersController.rejectBudget);

router.post('/budget/generate-approval-link', authMiddleware, ServiceOrdersController.generateBudgetApprovalLink);
router.get('/budget/approval-details/:token', ServiceOrdersController.getBudgetApprovalDetails);
router.post('/budget/approve-external', ServiceOrdersController.approveBudgetExternal);
router.post('/budget/reject-external', ServiceOrdersController.rejectBudgetExternal);

router.post('/diagnostic', authMiddleware, ServiceOrdersController.generateDiagnosticAndBudget);

router.post('/complete', authMiddleware, ServiceOrdersController.completeServiceOrder);
router.post('/deliver', authMiddleware, ServiceOrdersController.deliverVehicle);

router.post('/mechanic-work/add', authMiddleware, ServiceOrdersController.addMechanicWork);
router.post('/mechanic-work/update', authMiddleware, ServiceOrdersController.updateMechanicWork);

router.post('/vehicle-history', authMiddleware, ServiceOrdersController.getVehicleHistory);

router.post('/status/update', authMiddleware, ServiceOrdersController.updateStatus);

export default router;