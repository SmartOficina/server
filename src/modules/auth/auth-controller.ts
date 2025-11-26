import { SubscriptionModel, SubscriptionStatus } from '../subscription/subscription-entity';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import logger from '../../logger';
import { GarageService } from '../garage/garage-service';
import { PlanService } from '../plans/plans-service';

dotenv.config();

const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH || './keys/private.key', 'utf8');
const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH || './keys/public.key', 'utf8');
const jwtExpiration: any = process.env.JWT_EXPIRATION || '9h';

class AuthController {
    private static async getSubscriptionData(garage: any) {
        try {
            const activeSubscription = await SubscriptionModel.findOne({
                garageId: garage._id,
                status: SubscriptionStatus.ACTIVE,
                endDate: { $gt: new Date() }
            }).exec();

            let expiredSubscription = null;
            if (!activeSubscription) {
                expiredSubscription = await SubscriptionModel.findOne({
                    garageId: garage._id,
                    status: SubscriptionStatus.EXPIRED
                })
                    .sort({ endDate: -1 })
                    .exec();
            }

            const subscription = activeSubscription || expiredSubscription;

            if (subscription) {
                const plan = await PlanService.getPlanById(subscription.planId.toString());

                if (plan) {
                    return {
                        subscription: {
                            id: subscription._id,
                            startDate: subscription.startDate,
                            endDate: subscription.endDate,
                            status: subscription.status,
                            isExpired: subscription.status === SubscriptionStatus.EXPIRED,
                            renewalInfo: subscription.status === SubscriptionStatus.EXPIRED ? {
                                planId: plan._id,
                                planName: plan.name,
                                price: plan.price
                            } : null
                        },
                        plan: {
                            id: plan._id,
                            name: plan.name,
                            description: plan.description,
                            permissions: subscription.status === SubscriptionStatus.EXPIRED ? [] : plan.permissions
                        }
                    };
                }
            }

            return {
                subscription: {
                    status: "",
                    isExpired: false,
                },
                plan: {
                    name: 'Grátis',
                    permissions: []
                }
            };
        } catch (error) {
            return undefined;
        }
    }

    private static buildGarageResponse(garage: any, subscription?: any) {
        const garageResponse: any = {
            _id: garage._id,
            name: garage.name,
            cnpjCpf: garage.cnpjCpf,
            phone: garage.phone,
            email: garage.email,
            isActive: garage.isActive,
            createdAt: garage.createdAt,
            __v: garage.__v,
            isRegistrationComplete: garage.isRegistrationComplete,
            planId: garage.planId,
            address: garage.address,
            lastAccessAt: garage.lastAccessAt,
            lastLoginIp: garage.lastLoginIp
        };

        if (subscription) {
            garageResponse.subscription = subscription;
        }

        return garageResponse;
    }

    static async login(req: Request, res: Response) {
        const { email, cnpjCpf, password } = req.body;
        try {
            let garage: any;
            if (email) {
                garage = await GarageService.findGarageByEmail(email);
            } else if (cnpjCpf) {
                garage = await GarageService.findGarageByCnpjCpf(cnpjCpf);
            } else {
                return res.status(400).json({ msg: 'É necessário fornecer email ou cnpjCpf.' });
            }
            if (!garage) {
                logger.error({ error: 'Oficina não encontrada' }, 'AuthController::login()');
                return res.status(401).json({ msg: 'Credenciais inválidas' });
            }
            if (garage.isRegistrationComplete === false) {
                return res.status(202).json({
                    msg: 'Cadastro incompleto. Por favor, complete seu cadastro.',
                    garage: { id: garage._id, cnpjCpf: garage.cnpjCpf }
                });
            }
            const isPasswordValid = await bcrypt.compare(password, garage.password);
            if (!isPasswordValid) {
                logger.error({ error: 'Senha incorreta' }, 'AuthController::login()');
                return res.status(401).json({ msg: 'Credenciais inválidas' });
            }

            if (!garage.isActive) {
                logger.warn({ garageId: garage._id, email: garage.email }, 'Tentativa de login em conta desativada');
                
                if (garage.activationCode && garage.activationCodeExpiresAt && new Date() < garage.activationCodeExpiresAt) {
                    return res.status(403).json({ 
                        msg: 'Conta não ativada. Verifique seu email para ativar a conta.',
                        needsActivation: true,
                        canResendEmail: true
                    });
                } else {
                    return res.status(403).json({ 
                        msg: 'Conta não ativada. Código de ativação expirado.',
                        needsActivation: true,
                        canResendEmail: true,
                        codeExpired: true
                    });
                }
            }

            const subscription = await AuthController.getSubscriptionData(garage);

            const token = jwt.sign({ garageId: garage._id, email: garage.email }, privateKey, {
                algorithm: 'RS256',
                expiresIn: jwtExpiration
            });

            logger.info(`Oficina ${garage._id} logado com sucesso`, 'AuthController::login()');

            const garageResponse = AuthController.buildGarageResponse(garage, subscription);

            res.status(200).json({ token, garage: garageResponse, msg: 'Login bem-sucedido' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'AuthController::login()');
            res.status(500).json({ msg: 'Erro ao fazer login', error: error.message });
        }
    }

    static async loginWithToken(req: Request, res: Response) {
        try {
            const token = req.headers['authorization'];
            if (!token) {
                logger.error({ error: 'Token não fornecido' }, 'AuthController::loginWithToken()');
                return res.status(401).json({ msg: 'Token não fornecido' });
            }

            const jwtToken = token.split(' ')[1];
            const decoded: any = jwt.verify(jwtToken, publicKey, { algorithms: ['RS256'] });

            const garage: any = await GarageService.findGarageById(decoded.garageId);
            if (!garage) {
                logger.error({ error: 'Oficina não encontrada' }, 'AuthController::loginWithToken()');
                return res.status(401).json({ msg: 'Token inválido' });
            }

            if (!garage.isActive) {
                logger.warn({ garageId: garage._id, email: garage.email }, 'Token de conta desativada invalidado');
                return res.status(403).json({ 
                    msg: 'Conta desativada. Faça login novamente para ativar.',
                    needsActivation: true 
                });
            }

            const subscription = await AuthController.getSubscriptionData(garage);

            logger.info(`Oficina ${garage._id} autenticada via token`, 'AuthController::loginWithToken()');

            const garageResponse = AuthController.buildGarageResponse(garage, subscription);

            res.status(200).json({ msg: 'Token válido', garage: garageResponse });
        } catch (error: any) {
            logger.error({ error: error.message }, 'AuthController::loginWithToken()');
            res.status(500).json({ msg: 'Erro ao validar o token', error: error.message });
        }
    }

    static async generateToken(payload: any): Promise<string> {
        try {
            const token = jwt.sign(payload, privateKey, {
                algorithm: 'RS256',
                expiresIn: jwtExpiration
            });
            return token;
        } catch (error: any) {
            throw new Error(`Erro ao gerar token: ${error.message}`);
        }
    }
}

export default AuthController;