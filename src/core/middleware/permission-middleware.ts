import { Response, NextFunction } from 'express';
import logger from '../../logger';
import { PlanModel } from '../../modules/plans/plans-entity';
import { SubscriptionModel, SubscriptionStatus } from '../../modules/subscription/subscription-entity';

export function requirePermission(requiredPermission: string) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const { garageId } = req.user;

      if (!garageId) {
        return res.status(403).json({
          msg: 'Você precisa estar autenticado para acessar esta funcionalidade.'
        });
      }

      const activeSubscription = await SubscriptionModel.findOne({
        garageId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { $gt: new Date() }
      }).exec();

      if (!activeSubscription) {
        const expiredSubscription = await SubscriptionModel.findOne({
          garageId,
          status: SubscriptionStatus.EXPIRED
        })
          .sort({ endDate: -1 })
          .exec();

        if (expiredSubscription) {
          const expiredPlan = await PlanModel.findById(expiredSubscription.planId).exec();

          if (expiredPlan && expiredPlan.permissions.includes(requiredPermission)) {
            return res.status(403).json({
              msg: 'Sua assinatura expirou. Renove agora para continuar acessando esta funcionalidade.',
              subscriptionExpired: true,
              renewalInfo: {
                expiredPlanId: expiredPlan._id,
                expiredPlanName: expiredPlan.name,
                price: expiredPlan.price
              }
            });
          }
        }

        return res.status(403).json({
          msg: 'Para acessar esta funcionalidade, você precisa ter uma assinatura ativa. Por favor, adquira um plano ou entre em contato com nosso suporte.'
        });
      }

      const plan = await PlanModel.findById(activeSubscription.planId).exec();

      if (!plan || !plan.isActive) {
        return res.status(403).json({
          msg: 'O plano associado à sua assinatura não está mais disponível. Por favor, escolha um novo plano para continuar utilizando o sistema.'
        });
      }

      if (!plan.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          currentPlan: plan.name,
          requiredPermission: requiredPermission,
          msg: `Esta funcionalidade está disponível apenas em planos superiores ao seu atual (${plan.name}). Considere fazer um upgrade para desbloquear este e outros recursos adicionais.`
        });
      }

      next();
    } catch (error: any) {
      logger.error({ error: error.message }, 'PermissionMiddleware::requirePermission()');
      return res.status(500).json({
        msg: 'Ocorreu um erro ao verificar suas permissões. Por favor, tente novamente ou entre em contato com o suporte.'
      });
    }
  };
}