import logger from '../../logger';
import { GarageModel } from '.././../modules/garage/garage-entity';
import { Response, NextFunction } from 'express';
import { extractGarageIdFromToken } from './auth-middleware';

export async function activityTrackingMiddleware(req: any, res: Response, next: NextFunction) {
    try {
        const shouldUpdateActivity = !req.path.includes('/heartbeat');
        const authHeader = req.headers['authorization'];
        if (shouldUpdateActivity && authHeader) {
            const garageId = extractGarageIdFromToken(req);
            const userIp = getClientIp(req);

            await GarageModel.findByIdAndUpdate(garageId, {
                lastAccessAt: new Date(),
                lastActivityAt: new Date(),
                lastLoginIp: userIp,
                onlineStatus: 'online'
            }).exec();
        }

        next();
    } catch (error: any) {
        logger.error({ error: error.message }, 'ActivityTrackingMiddleware::activityTrackingMiddleware()');
        next();
    }
}

function getClientIp(req: any): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    if (ip === '::1') return '127.0.0.1';
    if (ip?.startsWith('::ffff:')) return ip.split(':').pop()!;
    return ip || 'IP desconhecido';
}

export async function updateHeartbeat(garageId: string) {
    try {
        await GarageModel.findByIdAndUpdate(garageId, {
            lastActivityAt: new Date(),
            onlineStatus: 'online'
        }).exec();

        logger.debug({ garageId }, 'Heartbeat atualizado com sucesso');
    } catch (error: any) {
        logger.error({ error: error.message, garageId }, 'ActivityTrackingMiddleware::updateHeartbeat()');
        throw error;
    }
}

export async function updateOnlineStatus() {
    const INACTIVE_THRESHOLD = 3 * 60 * 1000;

    try {
        const inactiveTime = new Date(Date.now() - INACTIVE_THRESHOLD);

        const result = await GarageModel.updateMany(
            {
                onlineStatus: 'online',
                lastActivityAt: { $lt: inactiveTime }
            },
            {
                onlineStatus: 'offline'
            }
        ).exec();

        if (result.modifiedCount > 0) {
            logger.info(`${result.modifiedCount} garagem(ns) marcada(s) como offline após ${INACTIVE_THRESHOLD / 1000} segundos de inatividade`);
        }
    } catch (error: any) {
        logger.error({ error: error.message }, 'ActivityTrackingMiddleware::updateOnlineStatus()');
    }
}