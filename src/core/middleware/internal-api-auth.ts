import { Request, Response, NextFunction } from 'express';
import logger from '../../logger';

/**
 * Middleware de autenticação para APIs internas
 * Usado para comunicação entre serviços internos (Discord bot, etc)
 */
export function internalApiAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.headers['x-internal-token'] as string;
    const expectedToken = process.env.INTERNAL_API_TOKEN;

    // Verificar se o token está configurado
    if (!expectedToken || expectedToken === 'change_this_token') {
      logger.error('INTERNAL_API_TOKEN não está configurado corretamente no .env');
      res.status(500).json({
        error: 'Configuração de segurança inválida'
      });
      return;
    }

    // Verificar se o token foi enviado
    if (!token) {
      logger.warn('Tentativa de acesso à API interna sem token');
      res.status(401).json({
        error: 'Token de autenticação não fornecido'
      });
      return;
    }

    // Verificar se o token está correto
    if (token !== expectedToken) {
      logger.warn('Tentativa de acesso à API interna com token inválido');
      res.status(401).json({
        error: 'Token de autenticação inválido'
      });
      return;
    }

    // Token válido, prosseguir
    next();
  } catch (error) {
    logger.error('Erro no middleware de autenticação interna:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
}
