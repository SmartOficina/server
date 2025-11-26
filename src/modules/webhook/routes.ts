import { Router } from 'express';
import WebhookController from './webhook-controller';

const router = Router();

router.post('/asaas', WebhookController.handleAsaasWebhook);

export default router;