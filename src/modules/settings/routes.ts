import { Router } from 'express';
import SettingsController from './settings-controller';
import { authMiddleware } from '../../core/middleware/auth-middleware';
import { Permission } from '../plans/permission-entity';
import { requirePermission } from '../../core/middleware/permission-middleware';

const router = Router();

router.get('/garage-info', authMiddleware, SettingsController.getGarageInfo);
router.get('/subscription-info', authMiddleware, SettingsController.getSubscriptionInfo);
router.get('/permissions', authMiddleware, SettingsController.getPermissions);
router.get('/subscription-history', authMiddleware, SettingsController.getSubscriptionHistory);

router.post('/update-garage', authMiddleware, requirePermission(Permission.SETTINGS_EDIT), SettingsController.updateGarageInfo);
router.post('/change-password', authMiddleware, requirePermission(Permission.SETTINGS_EDIT), SettingsController.changePassword);
router.post('/request-password-change-code', authMiddleware, requirePermission(Permission.SETTINGS_EDIT), SettingsController.requestPasswordChangeCode);
router.post('/change-password-with-code', authMiddleware, requirePermission(Permission.SETTINGS_EDIT), SettingsController.changePasswordWithCode);

export default router;