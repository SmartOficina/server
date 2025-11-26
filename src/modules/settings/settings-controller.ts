import { Request, Response } from 'express';
import logger from '../../logger';
import { SettingsService } from './settings-service';
import AuthController from '../auth/auth-controller';
import { GarageService } from '../garage/garage-service';

class SettingsController {
    static async getGarageInfo(req: any, res: Response) {
        try {
            const { garageId } = req.user;
            const garageInfo = await SettingsService.getGarageInfo(garageId);

            if (!garageInfo) {
                return res.status(404).json({ msg: 'Oficina não encontrada.' });
            }

            res.status(200).json({ result: garageInfo, msg: 'Informações da oficina obtidas com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::getGarageInfo()');
            res.status(500).json({ msg: 'Erro ao obter informações da oficina.', error: error.message });
        }
    }

    static async updateGarageInfo(req: any, res: Response) {
        try {
            const { garageId } = req.user;
            const garageData = req.body;

            if (!garageData.name) {
                return res.status(400).json({ msg: 'O nome da oficina é obrigatório.' });
            }

            if (!garageData.phone) {
                return res.status(400).json({ msg: 'O telefone é obrigatório.' });
            }

            if (!garageData.email) {
                return res.status(400).json({ msg: 'O email é obrigatório.' });
            }

            const updatedGarage = await SettingsService.updateGarageInfo(garageId, garageData);

            if (!updatedGarage) {
                return res.status(404).json({ msg: 'Oficina não encontrada.' });
            }

            res.status(200).json({ result: updatedGarage, msg: 'Informações da oficina atualizadas com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::updateGarageInfo()');
            res.status(500).json({ msg: error.message || 'Erro ao atualizar informações da oficina.' });
        }
    }

    static async changePassword(req: any, res: Response) {
        try {
            const { garageId } = req.user;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ msg: 'Senha atual e nova senha são obrigatórias.' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ msg: 'A nova senha deve ter pelo menos 6 caracteres.' });
            }

            const result = await SettingsService.changePassword(garageId, currentPassword, newPassword);

            res.status(200).json({ msg: 'Senha alterada com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::changePassword()');
            res.status(400).json({ msg: error.message || 'Erro ao alterar senha.' });
        }
    }

    static async getSubscriptionInfo(req: any, res: Response) {
        try {
            const { garageId } = req.user;
            const { subscription, plan } = await SettingsService.getSubscriptionInfo(garageId);

            res.status(200).json({ subscription, plan, msg: 'Informações de assinatura obtidas com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::getSubscriptionInfo()');
            res.status(500).json({ msg: 'Erro ao obter informações de assinatura.', error: error.message });
        }
    }

    static async getPermissions(req: any, res: Response) {
        try {
            const { garageId } = req.user;
            const permissions = await SettingsService.getPermissions(garageId);

            res.status(200).json({ permissions, msg: 'Permissões obtidas com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::getPermissions()');
            res.status(500).json({ msg: 'Erro ao obter permissões.', error: error.message });
        }
    }

    static async getSubscriptionHistory(req: any, res: Response) {
        try {
            const { garageId } = req.user;
            const subscriptions = await SettingsService.getSubscriptionHistory(garageId);

            res.status(200).json({ subscriptions, msg: 'Histórico de assinaturas obtido com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::getSubscriptionHistory()');
            res.status(500).json({ msg: 'Erro ao obter histórico de assinaturas.', error: error.message });
        }
    }

    static async requestPasswordChangeCode(req: any, res: Response) {
        try {
            const { garageId } = req.user;
            
            const garage = await SettingsService.getGarageInfo(garageId);
            if (!garage) {
                return res.status(404).json({ msg: 'Oficina não encontrada.' });
            }

            await GarageService.resendCode(garage.email, 'password_reset');
            
            res.status(200).json({ msg: 'Código de verificação enviado para seu e-mail.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::requestPasswordChangeCode()');
            res.status(500).json({ msg: 'Erro ao solicitar código de alteração de senha.', error: error.message });
        }
    }

    static async changePasswordWithCode(req: any, res: Response) {
        try {
            const { email, code, newPassword } = req.body;
            
            if (!email || !code || !newPassword) {
                return res.status(400).json({ msg: 'Email, código e nova senha são obrigatórios.' });
            }

            await GarageService.verifyCode(email, code, 'password_reset');
            
            await GarageService.resetPassword(email, newPassword);
            
            res.status(200).json({ msg: 'Senha alterada com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'SettingsController::changePasswordWithCode()');
            res.status(500).json({ msg: error.message || 'Erro ao alterar senha com código.', error: error.message });
        }
    }
}

export default SettingsController;