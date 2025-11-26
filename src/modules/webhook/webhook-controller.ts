import { Request, Response } from 'express';
import logger from '../../logger';
import SubscriptionService from '../../modules/subscription/subscription-service';
import { SubscriptionModel, SubscriptionStatus, PaymentStatus } from '../../modules/subscription/subscription-entity';
import { notificationService } from '../../core/services/notification-service';
import { GarageService } from '../garage/garage-service';
import { PlanService } from '../plans/plans-service';
import dotenv from 'dotenv';

dotenv.config();

class WebhookController {
    static async handleAsaasWebhook(req: Request, res: Response) {
        try {
            const accessToken = req.headers['asaas-access-token'];
            const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

            if (!accessToken || accessToken !== expectedToken) {
                logger.warn({
                    receivedToken: accessToken,
                    ip: req.ip
                }, 'Token de acesso inválido para webhook do Asaas');
                return res.status(401).json({ error: 'Token de acesso inválido' });
            }

            const { event, payment } = req.body;

            if (!event || !payment?.id) {
                logger.warn('Dados de webhook incompletos');
                return res.status(200).json({ msg: 'Dados incompletos' });
            }

            logger.info({
                event,
                paymentId: payment.id,
                status: payment.status
            }, 'Webhook do Asaas recebido');

            logger.debug({
                webhook: req.body
            }, 'Dados completos do webhook');

            switch (event) {
                case 'PAYMENT_RECEIVED':
                case 'PAYMENT_CONFIRMED':
                    await WebhookController.handlePaymentConfirmed(payment);
                    break;

                case 'PAYMENT_OVERDUE':
                    await WebhookController.handlePaymentOverdue(payment);
                    break;

                case 'PAYMENT_DELETED':
                case 'PAYMENT_REFUNDED':
                case 'PAYMENT_CANCELED':
                    await WebhookController.handlePaymentCanceled(payment);
                    break;

                default:
                    logger.info({ event }, 'Evento de webhook não processado');
            }

            return res.status(200).json({ msg: 'Webhook processado com sucesso' });
        } catch (error: any) {
            logger.error({
                error: error.message,
                stack: error.stack,
                body: JSON.stringify(req.body)
            }, 'WebhookController::handleAsaasWebhook()');

            return res.status(200).json({ msg: 'Webhook recebido, erro no processamento' });
        }
    }

    private static async handlePaymentConfirmed(payment: any) {
        try {
            const subscription = await SubscriptionModel.findOne({
                paymentReference: payment.id
            }).exec();

            if (!subscription) {
                logger.warn({ paymentId: payment.id }, 'Pagamento confirmado para assinatura não encontrada');
                return;
            }

            logger.info({
                paymentId: payment.id,
                subscriptionId: subscription._id,
                status: subscription.status
            }, 'Processando pagamento confirmado');

            if (subscription.status !== SubscriptionStatus.ACTIVE) {
                try {
                    if (!SubscriptionService || typeof SubscriptionService.activateSubscription !== 'function') {
                        throw new Error('Método activateSubscription não encontrado no SubscriptionService');
                    }

                    const activatedSubscription = await SubscriptionService.activateSubscription(subscription._id);

                    if (activatedSubscription) {
                        logger.info({
                            subscriptionId: subscription._id,
                            paymentId: payment.id,
                            garageId: subscription.garageId,
                            planId: subscription.planId
                        }, 'Assinatura ativada com sucesso após confirmação de pagamento via webhook');

                        const garage = await GarageService.findGarageById(subscription.garageId.toString());
                        const plan = await PlanService.getPlanById(subscription.planId.toString());
                        
                        if (garage && plan) {
                            const action = subscription.isRenewal ? 'renovacao' : 'nova';
                            await notificationService.sendSubscriptionNotification(
                                garage.name,
                                plan.name,
                                action,
                                payment.value || 0
                            );
                        }
                    } else {
                        throw new Error('Falha ao ativar assinatura após confirmação de pagamento PIX');
                    }
                } catch (error: any) {
                    logger.error({
                        error: error.message,
                        subscriptionId: subscription._id,
                        paymentId: payment.id
                    }, 'Erro ao ativar assinatura');
                    throw error;
                }
            } else {
                logger.info({
                    subscriptionId: subscription._id,
                    paymentId: payment.id
                }, 'Assinatura já está ativa, nenhuma ação necessária');
            }
        } catch (error: any) {
            logger.error({
                error: error.message,
                stack: error.stack,
                paymentId: payment.id
            }, 'Erro ao processar pagamento confirmado');

            throw error;
        }
    }

    private static async handlePaymentOverdue(payment: any) {
        try {
            const subscription = await SubscriptionModel.findOne({
                paymentReference: payment.id
            }).exec();

            if (!subscription) {
                logger.warn({ paymentId: payment.id }, 'Pagamento vencido para assinatura não encontrada');
                return;
            }

            if (subscription.status === SubscriptionStatus.PENDING) {
                await SubscriptionModel.findByIdAndUpdate(
                    subscription._id,
                    {
                        status: SubscriptionStatus.EXPIRED,
                        paymentStatus: PaymentStatus.FAILED,
                        updatedAt: new Date()
                    }
                ).exec();

                logger.info({
                    subscriptionId: subscription._id,
                    paymentId: payment.id
                }, 'Assinatura expirada devido a pagamento vencido');
            }
        } catch (error: any) {
            logger.error({
                error: error.message,
                stack: error.stack,
                paymentId: payment.id
            }, 'Erro ao processar pagamento vencido');

            throw error;
        }
    }

    private static async handlePaymentCanceled(payment: any) {
        try {
            const subscription = await SubscriptionModel.findOne({
                paymentReference: payment.id
            }).exec();

            if (!subscription) {
                logger.warn({ paymentId: payment.id }, 'Pagamento cancelado para assinatura não encontrada');
                return;
            }

            if (subscription.status === SubscriptionStatus.ACTIVE ||
                subscription.status === SubscriptionStatus.PENDING) {

                await SubscriptionModel.findByIdAndUpdate(
                    subscription._id,
                    {
                        status: SubscriptionStatus.CANCELED,
                        canceledAt: new Date(),
                        cancelReason: 'Pagamento cancelado ou estornado',
                        paymentStatus: PaymentStatus.REFUNDED,
                        updatedAt: new Date()
                    }
                ).exec();

                logger.info({
                    subscriptionId: subscription._id,
                    paymentId: payment.id
                }, 'Assinatura cancelada devido a pagamento cancelado ou estornado');
            }
        } catch (error: any) {
            logger.error({
                error: error.message,
                stack: error.stack,
                paymentId: payment.id
            }, 'Erro ao processar pagamento cancelado');

            throw error;
        }
    }
}

export default WebhookController;