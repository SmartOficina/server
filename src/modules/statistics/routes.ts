import { Router } from 'express';
import { statisticsController } from './statistics-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';

const router = Router();

router.use(authMiddleware);

router.get('/overview', statisticsController.getOverview.bind(statisticsController));

router.get('/service-orders', statisticsController.getServiceOrdersStats.bind(statisticsController));

router.get('/financial', statisticsController.getFinancialStats.bind(statisticsController));

router.get('/operational', statisticsController.getOperationalStats.bind(statisticsController));

router.get('/inventory', statisticsController.getInventoryStats.bind(statisticsController));

router.get('/schedule/today', statisticsController.getTodaySchedule.bind(statisticsController));

export default router;