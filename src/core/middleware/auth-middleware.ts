import jwt from 'jsonwebtoken';
import fs from 'fs';
import dotenv from 'dotenv';
import logger from '../../logger';
import { GarageModel } from '../../modules/garage/garage-entity';

dotenv.config();

const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH || './keys/public.key', 'utf8');

export async function authMiddleware(req: any, res: any, next: any) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        logger.error({ error: 'Token não fornecido' }, 'AuthMiddleware::authMiddleware()');
        return res.status(401).json({ msg: 'Acesso negado. Token de autenticação não foi fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as { garageId: string };

        const garage = await GarageModel.findById(decoded.garageId);
        if (!garage) {
            logger.error({ error: 'Oficina não encontrada' }, 'AuthMiddleware::authMiddleware()');
            return res.status(401).json({ msg: 'Token inválido. Oficina não existe mais.' });
        }

        req.user = { garageId: decoded.garageId };
        next();
    } catch (error: any) {
        logger.error({ error: error.message }, 'AuthMiddleware::authMiddleware()');
        return res.status(401).json({ msg: 'Token inválido. Faça login novamente para continuar.' });
    }
}

export function extractGarageIdFromToken(req: any): string {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        logger.error({ error: 'Token não fornecido' }, 'extractGarageIdFromToken()');
        throw new Error('Token não fornecido');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        logger.error({ error: 'Formato inválido do token' }, 'extractGarageIdFromToken()');
        throw new Error('Formato inválido do token');
    }

    const token = parts[1];

    try {
        const decoded: any = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
        if (!decoded.garageId) {
            throw new Error('garageId não presente no token');
        }
        return decoded.garageId;
    } catch (err: any) {
        logger.error({ error: err.message }, 'extractGarageIdFromToken()');
        throw new Error('Token inválido ou expirado');
    }
}