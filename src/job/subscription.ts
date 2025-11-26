import cron from 'node-cron';
import logger from '../logger';
import SubscriptionService from '../modules/subscription/subscription-service';

export function initSubscriptionCron() {
    async function checkExpiredSubscriptions() {
        try {
            logger.info('Iniciando verificação de assinaturas expiradas');

            const expiredCount = await SubscriptionService.checkExpiredSubscriptions();

            if (expiredCount > 0) {
                logger.info(`Verificação concluída: ${expiredCount} assinatura(s) atualizada(s) para expiradas`);
            } else {
                logger.info('Verificação concluída: nenhuma assinatura expirada encontrada');
            }
        } catch (error: any) {
            logger.error({ error: error.message }, 'Erro ao verificar assinaturas expiradas');
        }
    }

    cron.schedule('0 0 * * *', checkExpiredSubscriptions);

    logger.info('Executando verificação inicial de assinaturas expiradas na inicialização do servidor');
    checkExpiredSubscriptions();
}