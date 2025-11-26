import cron from 'node-cron';
import logger from '../logger';
import { updateOnlineStatus } from '../core/middleware/activity-tracking-middleware';

export function initOnlineStatusCron() {
    cron.schedule('* * * * *', async () => {
        try {
            await updateOnlineStatus();
        } catch (error: any) {
            logger.error({ error: error.message }, 'Erro ao atualizar status online das garagens');
        }
    });

    logger.info('Cron de status online inicializado (execução a cada 1 minuto)');
}