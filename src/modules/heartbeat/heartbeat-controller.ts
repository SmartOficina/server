import { Response } from 'express';
import logger from '../../logger';
import { updateHeartbeat } from '../../core/middleware/activity-tracking-middleware';

class HeartbeatController {
    static async sendHeartbeat(req: any, res: Response) {
        try {
            const { garageId } = req.user;

            if (!garageId) {
                return res.status(401).json({ msg: 'Usuário não autenticado' });
            }

            await updateHeartbeat(garageId);

            res.status(200).json({
                msg: 'Heartbeat recebido com sucesso',
                timestamp: new Date().toISOString()
            });
        } catch (error: any) {
            logger.error({ error: error.message }, 'HeartbeatController::sendHeartbeat()');
            res.status(500).json({ msg: 'Erro ao processar heartbeat' });
        }
    }
}

export default HeartbeatController;