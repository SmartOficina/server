import { Router } from 'express';
import GarageController from './garage-controller';

const router = Router();

router.post('/create', GarageController.createGarage);
router.post('/check-phone', GarageController.checkPhone);
router.post('/check-email', GarageController.checkEmail);
router.post('/check-cnpj-cpf', GarageController.checkCnpjCpf);
router.post('/verify-code', GarageController.handleCodeVerification);
router.post('/resend-code', GarageController.handleCodeResend);
router.post('/resend-activation-link', GarageController.resendActivationMagicLink);
router.post('/send-activation-email', GarageController.sendActivationEmail);
router.get('/activate/:token', GarageController.activateViaToken);
router.post('/reset-password', GarageController.resetPassword);

export default router;