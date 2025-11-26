import { CreditCardTokenModel, CreditCardTokenDocument } from './credit-card-entity';
import logger from '../../logger';

class CreditCardTokenService {
    static async saveCardToken(
        garageId: string,
        token: string,
        cardData: {
            lastFourDigits: string,
            cardBrand: string,
            holderName: string,
            expiryMonth: string,
            expiryYear: string
        }
    ): Promise<CreditCardTokenDocument> {
        try {
            const existingTokens = await CreditCardTokenModel.find({ garageId }).exec();
            const isDefault = existingTokens.length === 0;

            const existingToken = await CreditCardTokenModel.findOne({
                garageId,
                token
            }).exec();

            if (existingToken) {
                const updatedToken = await CreditCardTokenModel.findByIdAndUpdate(
                    existingToken._id,
                    {
                        lastFourDigits: cardData.lastFourDigits,
                        cardBrand: cardData.cardBrand,
                        holderName: cardData.holderName,
                        expiryMonth: cardData.expiryMonth,
                        expiryYear: cardData.expiryYear,
                        updatedAt: new Date()
                    },
                    { new: true }
                ).exec();

                if (!updatedToken) {
                    throw new Error('Falha ao atualizar token de cartão existente');
                }

                return updatedToken;
            }

            const newCardToken = new CreditCardTokenModel({
                garageId,
                token,
                lastFourDigits: cardData.lastFourDigits,
                cardBrand: cardData.cardBrand,
                holderName: cardData.holderName,
                expiryMonth: cardData.expiryMonth,
                expiryYear: cardData.expiryYear,
                isDefault,
                createdAt: new Date()
            });

            return await newCardToken.save();
        } catch (error: any) {
            logger.error({ error: error.message }, 'CreditCardTokenService::saveCardToken()');
            throw new Error(`Erro ao salvar token de cartão: ${error.message}`);
        }
    }

    static async getCardsByGarageId(garageId: string): Promise<CreditCardTokenDocument[]> {
        try {
            return await CreditCardTokenModel.find({ garageId })
                .sort({ isDefault: -1, createdAt: -1 })
                .exec();
        } catch (error: any) {
            logger.error({ error: error.message }, 'CreditCardTokenService::getCardsByGarageId()');
            throw new Error(`Erro ao buscar cartões salvos: ${error.message}`);
        }
    }

    static async setDefaultCard(cardTokenId: string, garageId: string): Promise<boolean> {
        try {
            await CreditCardTokenModel.updateMany(
                { garageId },
                { isDefault: false }
            ).exec();

            const result = await CreditCardTokenModel.findOneAndUpdate(
                { _id: cardTokenId, garageId },
                { isDefault: true, updatedAt: new Date() },
                { new: true }
            ).exec();

            return !!result;
        } catch (error: any) {
            logger.error({ error: error.message }, 'CreditCardTokenService::setDefaultCard()');
            throw new Error(`Erro ao definir cartão padrão: ${error.message}`);
        }
    }

    static async deleteCard(cardTokenId: string, garageId: string): Promise<boolean> {
        try {
            const card = await CreditCardTokenModel.findOne({
                _id: cardTokenId,
                garageId
            }).exec();

            if (!card) {
                return false;
            }

            await CreditCardTokenModel.deleteOne({ _id: cardTokenId }).exec();

            if (card.isDefault) {
                const remainingCards = await CreditCardTokenModel.find({ garageId })
                    .sort({ createdAt: -1 })
                    .limit(1)
                    .exec();

                if (remainingCards.length > 0) {
                    await CreditCardTokenModel.findByIdAndUpdate(
                        remainingCards[0]._id,
                        { isDefault: true, updatedAt: new Date() }
                    ).exec();
                }
            }

            return true;
        } catch (error: any) {
            logger.error({ error: error.message }, 'CreditCardTokenService::deleteCard()');
            throw new Error(`Erro ao remover cartão: ${error.message}`);
        }
    }
}

export default CreditCardTokenService;