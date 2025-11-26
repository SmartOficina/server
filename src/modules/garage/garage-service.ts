import AuthController from '../auth/auth-controller';
import { emailService } from '../../core/middleware/services/email-service';
import { GarageDocument } from './garage-entity';
import { GarageModelHandler } from './garage-model';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class GarageService {
    static async listGarages(search: string, limit: number, page: number): Promise<{ garages: GarageDocument[], totalPages: number }> {
        return await GarageModelHandler.find(search, limit, page);
    }

    static async createGarage(garageData: Omit<GarageDocument, '_id'>): Promise<GarageDocument> {
        if (!garageData.name) throw new Error('O campo Nome da Oficina é obrigatório.');
        if (!garageData.email) throw new Error('O campo E-mail é obrigatório.');
        if (!garageData.password) throw new Error('O campo Senha é obrigatório.');
        if (!garageData.phone) throw new Error('O campo Celular é obrigatório.');
        if (!garageData.cnpjCpf) throw new Error('O campo CNPJ/CPF é obrigatório.');


        const hashedPassword = await bcrypt.hash(garageData.password, 10);
        const activationToken = `garage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24);
        let newGarage: GarageDocument | null = null;
        try {
            newGarage = await GarageModelHandler.create({
                ...garageData,
                password: hashedPassword,
                activationCode: activationToken,
                activationCodeExpiresAt: expirationTime,
                isActive: false
            });
            return newGarage;
        } catch (error: any) {
            if (error.code === 11000) {
                const duplicateField = Object.keys(error.keyValue)[0];
                let fieldMessage = '';
                if (duplicateField === 'email') fieldMessage = 'E-mail';
                else if (duplicateField === 'cnpjCpf') fieldMessage = 'CNPJ/CPF';
                else if (duplicateField === 'phone') fieldMessage = 'Celular';
                throw new Error(`${fieldMessage} já está cadastrado.`);
            }
            if (newGarage) {
                await GarageModelHandler.delete(newGarage.id);
            }
            throw new Error(`Erro ao criar garagem: ${error.message}`);
        }
    }

    static async activateGarage(email: string, code: string): Promise<{ token: string; garage: any }> {
        const garage = await GarageModelHandler.findByEmail(email);
        if (!garage) throw new Error('Garagem não encontrada.');
        if (garage.activationCodeExpiresAt && new Date() > garage.activationCodeExpiresAt) throw new Error('O código de ativação expirou.');
        if ((garage.activationAttempts || 0) >= 5) throw new Error('Muitas tentativas inválidas. Solicite um novo código.');
        const isCodeValid = await bcrypt.compare(code, garage.activationCode || '');
        if (!isCodeValid) {
            await GarageModelHandler.update(garage.id, { activationAttempts: (garage.activationAttempts || 0) + 1 });
            throw new Error('Código de ativação inválido.');
        }
        await GarageModelHandler.update(garage.id, {
            isActive: true,
            activationCode: null,
            activationCodeExpiresAt: null,
            activationAttempts: 0
        });
        const token = await AuthController.generateToken({
            garageId: garage.id,
            email: garage.email
        });
        return {
            token,
            garage: {
                id: garage.id,
                email: garage.email,
                name: garage.name,
                phone: garage.phone
            }
        };
    }

    static async sendActivationEmail(garageId: string): Promise<void> {
        const garage = await GarageModelHandler.findById(garageId);
        if (!garage) throw new Error('Garagem não encontrada.');
        if (garage.isActive) throw new Error('Conta já está ativa.');
        
        if (garage.activationCode) {
            await emailService.sendActivationMagicLink(garage.email, garage.activationCode);
        } else {
            throw new Error('Token de ativação não encontrado.');
        }
    }

    static async activateViaToken(activationToken: string): Promise<{ success: boolean; message?: string; authToken?: string; garage?: any }> {
        try {
            const garage = await GarageModelHandler.findByActivationCode(activationToken);
            
            if (!garage) {
                return { success: false, message: 'Token de ativação inválido ou não encontrado.' };
            }

            if (garage.activationCodeExpiresAt && new Date() > garage.activationCodeExpiresAt) {
                return { success: false, message: 'Token de ativação expirado. Solicite um novo link de ativação.' };
            }

            if (garage.isActive) {
                return { success: false, message: 'Esta conta já foi ativada anteriormente.' };
            }

            await GarageModelHandler.update(garage.id, {
                isActive: true,
                activationCode: null,
                activationCodeExpiresAt: null,
                activationAttempts: 0
            });

            const authToken = await AuthController.generateToken({
                garageId: garage.id,
                email: garage.email
            });

            return {
                success: true,
                authToken,
                garage: {
                    id: garage.id,
                    email: garage.email,
                    name: garage.name,
                    phone: garage.phone
                }
            };
        } catch (error: any) {
            return { success: false, message: `Erro interno: ${error.message}` };
        }
    }

    static async editGarage(id: string, garageData: Partial<GarageDocument>): Promise<GarageDocument | null> {
        if (!id) throw new Error('O campo "id" é obrigatório para editar a garagem.');
        return await GarageModelHandler.update(id, garageData);
    }

    static async removeGarage(id: string): Promise<boolean> {
        if (!id) throw new Error('O campo "id" é obrigatório para remover a garagem.');
        return await GarageModelHandler.delete(id);
    }

    static async findGarageByEmail(email: string): Promise<GarageDocument | null> {
        if (!email) throw new Error('O campo "email" é obrigatório.');
        return await GarageModelHandler.findByEmail(email);
    }

    static async findGarageById(id: string): Promise<GarageDocument | null> {
        if (!id) throw new Error('O campo "id" é obrigatório.');
        return await GarageModelHandler.findById(id);
    }

    static async checkPhone(phone: string): Promise<boolean> {
        if (!phone) throw new Error('O campo "phone" é obrigatório.');
        const garage = await GarageModelHandler.findByPhone(phone);
        return !!garage;
    }

    static async checkEmail(email: string): Promise<boolean> {
        if (!email) throw new Error('O campo "email" é obrigatório.');
        const garage = await GarageModelHandler.findByEmail(email);
        return !!garage;
    }

    static async checkCnpjCpf(cnpjCpf: string): Promise<boolean> {
        if (!cnpjCpf) throw new Error('O campo "cnpjCpf" é obrigatório.');
        const garage = await GarageModelHandler.findByCnpjCpf(cnpjCpf);
        return !!garage;
    }

    static async resendCode(email: string, context: 'activation' | 'password_reset'): Promise<void> {
        if (!email || !context) throw new Error('Os campos "email" e "context" são obrigatórios.');
        const garage = await GarageModelHandler.findByEmail(email);
        if (!garage) throw new Error('Garagem não encontrada.');
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = await bcrypt.hash(code, 10);
        const expirationTime = new Date();
        expirationTime.setMinutes(expirationTime.getMinutes() + 15);
        await GarageModelHandler.update(garage.id, {
            activationCode: hashedCode,
            activationCodeExpiresAt: expirationTime,
            activationAttempts: 0
        });
        if (context === 'activation') {
            await emailService.sendActivationEmail(garage.email, code);
        } else if (context === 'password_reset') {
            await emailService.sendPasswordResetEmail(garage.email, code);
        }
    }

    static async resendActivationMagicLink(email: string): Promise<void> {
        if (!email) throw new Error('O campo "email" é obrigatório.');
        const garage = await GarageModelHandler.findByEmail(email);
        if (!garage) throw new Error('Garagem não encontrada.');
        
        if (garage.isActive) {
            throw new Error('Esta conta já está ativada.');
        }
        
        const activationToken = crypto.randomBytes(32).toString('hex');
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24);
        
        await GarageModelHandler.update(garage.id, {
            activationCode: activationToken,
            activationCodeExpiresAt: expirationTime,
            activationAttempts: 0
        });
        
        await emailService.sendActivationMagicLink(garage.email, activationToken);
    }

    static async verifyCode(email: string, code: string, context: 'activation' | 'password_reset'): Promise<{ token?: string; garage?: any }> {
        if (!email || !code || !context) throw new Error('Os campos "email", "code" e "context" são obrigatórios.');
        const garage = await GarageModelHandler.findByEmail(email);
        if (!garage) throw new Error('Garagem não encontrada.');
        if (!garage.activationCode || !garage.activationCodeExpiresAt || new Date() > garage.activationCodeExpiresAt) throw new Error('Código inválido ou expirado.');
        const isCodeValid = await bcrypt.compare(code, garage.activationCode);
        if (!isCodeValid) {
            await GarageModelHandler.update(garage.id, { activationAttempts: (garage.activationAttempts || 0) + 1 });
            throw new Error('Código inválido.');
        }
        if (context === 'activation') {
            await GarageModelHandler.update(garage.id, {
                activationCode: null,
                activationCodeExpiresAt: null,
                activationAttempts: 0
            });
        }
        if (context === 'activation') {
            const tokenPayload = { garageId: garage.id, email: garage.email };
            const token = await AuthController.generateToken(tokenPayload);
            return {
                token,
                garage: {
                    id: garage.id,
                    email: garage.email,
                    name: garage.name,
                    phone: garage.phone
                }
            };
        }
        return {};
    }

    static async resetPassword(email: string, newPassword: string): Promise<{ token?: string; garage?: any }> {
        if (!email || !newPassword) throw new Error('Os campos "email" e "newPassword" são obrigatórios.');
        const garage = await GarageModelHandler.findByEmail(email);
        if (!garage) throw new Error('Garagem não encontrada.');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await GarageModelHandler.update(garage.id, { password: hashedPassword });
        const tokenPayload = { garageId: garage.id, email: garage.email };
        const token = await AuthController.generateToken(tokenPayload);
        await GarageModelHandler.update(garage.id, {
            activationCode: null,
            activationCodeExpiresAt: null,
            activationAttempts: 0
        });
        return {
            token,
            garage: {
                id: garage.id,
                email: garage.email,
                name: garage.name,
                phone: garage.phone
            }
        };
    }

    static async findGarageByCnpjCpf(cnpjCpf: string): Promise<GarageDocument | null> {
        if (!cnpjCpf) throw new Error('O campo "cnpjCpf" é obrigatório.');
        return await GarageModelHandler.findByCnpjCpf(cnpjCpf);
    }

    static async createGarageWithPartialData(cnpjCpf: string, password: string): Promise<GarageDocument> {
        if (!cnpjCpf) throw new Error('O campo "cnpjCpf" é obrigatório.');
        if (!password) throw new Error('O campo "password" é obrigatório.');

        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const newGarage = await GarageModelHandler.create({
                cnpjCpf,
                password: hashedPassword,
                isRegistrationComplete: false,
                isActive: false,
                name: "Cadastro Incompleto",
                email: `temp-${Date.now()}@example.com`,
                phone: "0000000000",
                address: {
                    street: '',
                    number: '',
                    district: '',
                    city: '',
                    state: '',
                    zipCode: ''
                }
            } as any);

            return newGarage;
        } catch (error: any) {
            if (error.code === 11000) {
                throw new Error('CNPJ/CPF já está cadastrado.');
            }
            throw new Error(`Erro ao criar pré-cadastro: ${error.message}`);
        }
    }

    static async updateGaragePlan(garageId: string, planId: any, endDate: Date): Promise<GarageDocument | null> {
        if (!garageId) throw new Error('O ID da garagem é obrigatório.');
        if (!planId) throw new Error('O ID do plano é obrigatório.');
        return await GarageModelHandler.update(garageId, {
            planId,
            planExpiresAt: endDate
        });
    }
}