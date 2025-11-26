import { GarageModel } from '../garage/garage-entity';
import { GarageModelHandler } from '../garage/garage-model';
import SubscriptionService from '../subscription/subscription-service';
import { PlanService } from '../plans/plans-service';
import bcrypt from 'bcrypt';
import logger from '../../logger';
import { SubscriptionStatus } from '../subscription/subscription-entity';

export class SettingsService {
    static async getGarageInfo(garageId: string): Promise<any> {
        if (!garageId) throw new Error('ID da oficina não fornecido.');

        const garage = await GarageModelHandler.findById(garageId);
        if (!garage) throw new Error('Oficina não encontrada.');

        return garage;
    }

    static async updateGarageInfo(garageId: string, garageData: any): Promise<any> {
        if (!garageId) throw new Error('ID da oficina não fornecido.');

        if (garageData.email) {
            const existingGarage = await GarageModelHandler.findByEmail(garageData.email);
            if (existingGarage && existingGarage.id !== garageId) {
                throw new Error('Este e-mail já está sendo usado por outra oficina.');
            }
        }

        if (garageData.phone) {
            const existingGarage = await GarageModelHandler.findByPhone(garageData.phone);
            if (existingGarage && existingGarage.id !== garageId) {
                throw new Error('Este telefone já está sendo usado por outra oficina.');
            }
        }

        const updatedGarage = await GarageModelHandler.update(garageId, {
            name: garageData.name,
            phone: garageData.phone,
            email: garageData.email,
            address: garageData.address
        });

        return updatedGarage;
    }

    static async changePassword(garageId: string, currentPassword: string, newPassword: string): Promise<boolean> {
        if (!garageId) throw new Error('ID da oficina não fornecido.');
        if (!currentPassword) throw new Error('Senha atual não fornecida.');
        if (!newPassword) throw new Error('Nova senha não fornecida.');

        const garage = await GarageModel.findById(garageId);
        if (!garage) throw new Error('Oficina não encontrada.');

        const isPasswordValid = await bcrypt.compare(currentPassword, garage.password);
        if (!isPasswordValid) {
            throw new Error('Senha atual incorreta.');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await GarageModelHandler.update(garageId, { password: hashedPassword });

        logger.info({ garageId }, 'Senha alterada com sucesso');
        return true;
    }

    static async getSubscriptionInfo(garageId: string): Promise<{ subscription: any, plan: any }> {
        if (!garageId) throw new Error('ID da oficina não fornecido.');

        const activeSubscription = await SubscriptionService.getActiveSubscription(garageId);

        let plan = null;
        if (activeSubscription) {
            plan = await PlanService.getPlanById(activeSubscription.planId.toString());
        } else {
            const garage = await GarageModelHandler.findById(garageId);
            if (garage && garage.planId) {
                plan = await PlanService.getPlanById(garage.planId.toString());
            }
        }

        return {
            subscription: activeSubscription,
            plan
        };
    }

    static async getPermissions(garageId: string): Promise<{ [key: string]: boolean }> {
        if (!garageId) throw new Error('ID da oficina não fornecido.');

        const { subscription, plan } = await this.getSubscriptionInfo(garageId);

        if (!plan || (subscription && subscription.status !== SubscriptionStatus.ACTIVE)) {
            return {};
        }

        const permissions: { [key: string]: boolean } = {};

        const allPermissions = [
            'client:view', 'client:create', 'client:edit', 'client:delete',
            'vehicle:view', 'vehicle:create', 'vehicle:edit', 'vehicle:delete',
            'service-order:view', 'service-order:create', 'service-order:edit', 'service-order:delete', 'service-order:budget',
            'schedule:view', 'schedule:create', 'schedule:edit', 'schedule:delete',
            'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
            'finance:view', 'finance:create', 'finance:edit', 'finance:delete',
            'mechanic:view', 'mechanic:create', 'mechanic:edit', 'mechanic:delete',
            'priority-support:access',
            'reports:view',
            'settings:view', 'settings:edit'
        ];

        allPermissions.forEach(perm => {
            permissions[perm] = false;
        });

        if (plan.permissions && Array.isArray(plan.permissions)) {
            plan.permissions.forEach((perm: string) => {
                permissions[perm] = true;
            });
        }

        return permissions;
    }

    static async getSubscriptionHistory(garageId: string): Promise<any[]> {
        if (!garageId) throw new Error('ID da oficina não fornecido.');

        try {
            const subscriptions = await SubscriptionService.getSubscriptionHistory(garageId);
            return subscriptions || [];
        } catch (error) {
            logger.error({ error, garageId }, 'Erro ao obter histórico de assinaturas');
            return [];
        }
    }
}

export default SettingsService;