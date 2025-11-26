import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../../logger';
import CreditCardTokenService from '../../modules/credit-card/credit-card-service';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'dev';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

const API_URL = NODE_ENV === 'prod' ? 'https://www.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';

export type CreditCardData = {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
};

export type CreditCardHolderInfo = {
    name?: string;
    email?: string;
    cpfCnpj: string;
    postalCode?: string;
    addressNumber?: string;
    phone?: string;
};

export enum AsaasPaymentStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    RECEIVED = 'RECEIVED',
    OVERDUE = 'OVERDUE',
    REFUNDED = 'REFUNDED',
    CANCELED = 'CANCELED',
    FAILED = 'FAILED'
}

class AsaasPayment {
    private static apiHeaders = {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
    };

    static async createOrGetCustomer(garage: any): Promise<string> {
        try {
            if (!garage) {
                throw new Error('Dados da garagem são obrigatórios');
            }
            
            if (!garage.name || garage.name.trim() === '') {
                throw new Error('Nome da garagem é obrigatório');
            }
            
            if (!garage.email || garage.email.trim() === '') {
                throw new Error('Email da garagem é obrigatório');
            }

            if (NODE_ENV !== 'prod') {
                logger.info({ 
                    garageName: garage.name, 
                    garageEmail: garage.email, 
                    env: NODE_ENV 
                }, 'Retornando cliente mock em ambiente de desenvolvimento');

                return `mock_customer_${garage._id || Date.now()}`;
            }

            const checkResponse = await axios.get(`${API_URL}/customers?email=${encodeURIComponent(garage.email)}`, {
                headers: this.apiHeaders
            });

            if (checkResponse.data.data && checkResponse.data.data.length > 0) {
                return checkResponse.data.data[0].id;
            }

            const customerData = {
                name: garage.name,
                email: garage.email,
                phone: garage.phone?.replace(/\D/g, '') || '',
                cpfCnpj: garage.cnpjCpf?.replace(/\D/g, '') || '',
                notificationDisabled: true,
                mobilePhone: garage.phone?.replace(/\D/g, '') || '',
                address: (garage.address?.street && garage.address.street.trim().length > 0) 
                    ? garage.address.street 
                    : 'Av. Paulista',
                addressNumber: (garage.address?.number && garage.address.number.trim().length > 0) 
                    ? garage.address.number 
                    : '1000',
                province: (garage.address?.district && garage.address.district.trim().length > 0) 
                    ? garage.address.district 
                    : 'Bela Vista',
                postalCode: (garage.address?.zipCode && garage.address.zipCode.replace(/\D/g, '').length > 0) 
                    ? garage.address.zipCode.replace(/\D/g, '') 
                    : '01310100'
            };

            logger.info({ 
                customerData, 
                garageId: garage._id 
            }, 'Criando customer no Asaas');

            const response = await axios.post(`${API_URL}/customers`, customerData, {
                headers: this.apiHeaders
            });

            return response.data.id;
        } catch (error: any) {
            logger.error({
                error: error.response?.data || error.message,
                garage: garage._id
            }, 'AsaasPayment::createOrGetCustomer()');
            throw new Error(`Erro ao criar/obter cliente: ${error.message}`);
        }
    }

    static async createCreditCardPayment(
        customerId: string,
        value: number,
        description: string,
        creditCardData: CreditCardData,
        holderInfo: CreditCardHolderInfo,
        planId: string,
        garageId: string
    ): Promise<any> {
        try {
            if (NODE_ENV !== 'prod') {
                logger.info({ 
                    customerId, 
                    value, 
                    description, 
                    env: NODE_ENV 
                }, 'Simulando pagamento por cartão aprovado em ambiente de desenvolvimento');

                const mockPaymentId = `mock_payment_${Date.now()}`;
                const mockCardToken = `mock_token_${Date.now()}`;
                
                try {
                    await CreditCardTokenService.saveCardToken(
                        garageId,
                        mockCardToken,
                        {
                            lastFourDigits: creditCardData.number.slice(-4),
                            cardBrand: 'VISA', // Mock brand
                            holderName: creditCardData.holderName,
                            expiryMonth: creditCardData.expiryMonth,
                            expiryYear: creditCardData.expiryYear
                        }
                    );
                } catch (tokenError: any) {
                    logger.warn({
                        error: tokenError.message,
                        garageId
                    }, 'Erro ao salvar token de cartão mock, continuando com pagamento');
                }

                return {
                    paymentId: mockPaymentId,
                    status: 'CONFIRMED',
                    invoiceUrl: `https://mock-invoice-url.com/${mockPaymentId}`,
                    creditCardToken: mockCardToken,
                    cardBrand: 'VISA',
                    cardNumber: `****${creditCardData.number.slice(-4)}`
                };
            }

            const creditCardHolderInfo = {
                name: holderInfo.name || creditCardData.holderName,
                email: holderInfo.email || '',
                cpfCnpj: holderInfo.cpfCnpj,
                postalCode: (holderInfo.postalCode && holderInfo.postalCode.trim().length > 0) 
                    ? holderInfo.postalCode 
                    : '01310-100',
                addressNumber: (holderInfo.addressNumber && holderInfo.addressNumber.trim().length > 0) 
                    ? holderInfo.addressNumber 
                    : '1000',
                phone: holderInfo.phone || ''
            };

            const dueDate = new Date();
            dueDate.setHours(dueDate.getHours() + 4);

            const paymentData = {
                customer: customerId,
                billingType: 'CREDIT_CARD',
                dueDate: dueDate.toISOString().split('T')[0],
                value: value,
                description: description,
                externalReference: planId,
                creditCard: {
                    holderName: creditCardData.holderName,
                    number: creditCardData.number,
                    expiryMonth: creditCardData.expiryMonth,
                    expiryYear: creditCardData.expiryYear,
                    ccv: creditCardData.ccv
                },
                creditCardHolderInfo: creditCardHolderInfo,
                remoteIp: '127.0.0.1'
            };

            const response = await axios.post(`${API_URL}/payments`, paymentData, {
                headers: this.apiHeaders
            });

            if (response.data.status === 'CONFIRMED' && response.data.creditCard) {
                try {
                    await CreditCardTokenService.saveCardToken(
                        garageId,
                        response.data.creditCard.creditCardToken,
                        {
                            lastFourDigits: response.data.creditCard.creditCardNumber.slice(-4),
                            cardBrand: response.data.creditCard.creditCardBrand,
                            holderName: creditCardData.holderName,
                            expiryMonth: creditCardData.expiryMonth,
                            expiryYear: creditCardData.expiryYear
                        }
                    );
                } catch (tokenError: any) {
                    logger.warn({
                        error: tokenError.message,
                        garageId
                    }, 'Erro ao salvar token de cartão, continuando com pagamento');
                }
            }

            return {
                paymentId: response.data.id,
                status: response.data.status,
                invoiceUrl: response.data.invoiceUrl,
                creditCardToken: response.data.creditCard?.creditCardToken,
                cardBrand: response.data.creditCard?.creditCardBrand,
                cardNumber: response.data.creditCard?.creditCardNumber
            };
        } catch (error: any) {
            logger.error({
                error: error.response?.data || error.message,
                customerId
            }, 'AsaasPayment::createCreditCardPayment()');
            throw new Error(`Erro ao processar pagamento: ${error.response?.data?.errors?.[0]?.description || error.message}`);
        }
    }

    static async createPaymentWithToken(
        customerId: string,
        value: number,
        description: string,
        creditCardToken: string,
        planId: string,
        cvv: string
    ): Promise<any> {
        try {
            if (NODE_ENV !== 'prod') {
                logger.info({ 
                    customerId, 
                    value, 
                    description, 
                    creditCardToken, 
                    env: NODE_ENV 
                }, 'Simulando pagamento com token aprovado em ambiente de desenvolvimento');

                const mockPaymentId = `mock_token_payment_${Date.now()}`;
                
                return {
                    paymentId: mockPaymentId,
                    status: 'CONFIRMED',
                    invoiceUrl: `https://mock-invoice-url.com/${mockPaymentId}`,
                    creditCardToken: creditCardToken,
                    cardBrand: 'VISA',
                    cardNumber: '****1234'
                };
            }

            const dueDate = new Date();
            dueDate.setHours(dueDate.getHours() + 4);

            const paymentData = {
                customer: customerId,
                billingType: 'CREDIT_CARD',
                dueDate: dueDate.toISOString().split('T')[0],
                value: value,
                description: description,
                externalReference: planId,
                creditCardToken: creditCardToken,
                creditCardCcv: cvv,
                remoteIp: '127.0.0.1'
            };

            const response = await axios.post(`${API_URL}/payments`, paymentData, {
                headers: this.apiHeaders
            });

            return {
                paymentId: response.data.id,
                status: response.data.status,
                invoiceUrl: response.data.invoiceUrl,
                creditCardToken: response.data.creditCard?.creditCardToken,
                cardBrand: response.data.creditCard?.creditCardBrand,
                cardNumber: response.data.creditCard?.creditCardNumber
            };
        } catch (error: any) {
            logger.error({
                error: error.response?.data || error.message,
                customerId
            }, 'AsaasPayment::createPaymentWithToken()');
            throw new Error(`Erro ao processar pagamento com token: ${error.response?.data?.errors?.[0]?.description || error.message}`);
        }
    }

    static async createPixPayment(
        customerId: string,
        value: number,
        description: string,
        planId: string
    ): Promise<any> {
        try {
            const dueDate = new Date();
            dueDate.setHours(dueDate.getHours() + 4);

            const paymentData = {
                customer: customerId,
                billingType: 'PIX',
                value: value,
                description: description,
                externalReference: planId,
                dueDate: dueDate.toISOString().split('T')[0],
                remoteIp: '127.0.0.1'
            };

            logger.info({ 
                customerId, 
                value, 
                description, 
                planId, 
                paymentData 
            }, 'Criando pagamento PIX no Asaas');

            const response = await axios.post(`${API_URL}/payments`, paymentData, {
                headers: this.apiHeaders
            });

            logger.debug({
                responseData: response.data,
                paymentId: response.data.id
            }, 'Resposta da API do Asaas para pagamento PIX');

            const pixData = await this.getPixQrCode(response.data.id);
            return {
                paymentId: response.data.id,
                status: response.data.status,
                invoiceUrl: response.data.invoiceUrl,
                pixQrCode: pixData.encodedImage,
                pixCopiaECola: pixData.payload,
                expirationDate: pixData.expirationDate
            };
        } catch (error: any) {
            logger.error({
                error: error.response?.data || error.message,
                customerId
            }, 'AsaasPayment::createPixPayment()');
            throw new Error(`Erro ao gerar pagamento PIX: ${error.response?.data?.errors?.[0]?.description || error.message}`);
        }
    }

    static async getPixQrCode(paymentId: string): Promise<any> {
        try {
            const response = await axios.get(`${API_URL}/payments/${paymentId}/pixQrCode`, {
                headers: this.apiHeaders
            });

            return {
                encodedImage: response.data.encodedImage,
                payload: response.data.payload,
                expirationDate: response.data.expirationDate
            };
        } catch (error: any) {
            logger.error({
                error: error.response?.data || error.message,
                paymentId
            }, 'AsaasPayment::getPixQrCode()');
            throw new Error(`Erro ao obter QR Code PIX: ${error.message}`);
        }
    }

    static async getPaymentStatus(paymentId: string): Promise<AsaasPaymentStatus | null> {
        try {
            const response = await axios.get(`${API_URL}/payments/${paymentId}`, {
                headers: this.apiHeaders
            });

            return response.data.status as AsaasPaymentStatus;
        } catch (error: any) {
            logger.error({
                error: error.response?.data || error.message,
                paymentId
            }, 'AsaasPayment::getPaymentStatus()');

            if (error.response?.status === 404) {
                return null;
            }

            throw new Error(`Erro ao verificar status do pagamento: ${error.message}`);
        }
    }

    static async cancelPayment(paymentId: string): Promise<boolean> {
        try {
            await axios.delete(`${API_URL}/payments/${paymentId}`, {
                headers: this.apiHeaders
            });

            return true;
        } catch (error: any) {
            logger.error({
                error: error.response?.data || error.message,
                paymentId
            }, 'AsaasPayment::cancelPayment()');
            return false;
        }
    }
}

export default AsaasPayment;