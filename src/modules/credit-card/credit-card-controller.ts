import { Request, Response } from 'express';
import logger from '../../logger';
import CreditCardTokenService from './credit-card-service';

class CardManagementController {
    static async listSavedCards(req: any, res: Response) {
        try {
            const { garageId } = req.user;

            if (!garageId) {
                return res.status(400).json({ msg: 'ID da garagem é obrigatório.' });
            }

            const cards = await CreditCardTokenService.getCardsByGarageId(garageId);

            const formattedCards = cards.map(card => ({
                id: card._id,
                lastFourDigits: card.lastFourDigits,
                cardBrand: card.cardBrand,
                holderName: card.holderName,
                expiryMonth: card.expiryMonth,
                expiryYear: card.expiryYear,
                isDefault: card.isDefault,
                displayName: `${card.cardBrand} terminado em ${card.lastFourDigits}`,
                createdAt: card.createdAt
            }));

            return res.status(200).json({
                result: formattedCards,
                msg: formattedCards.length > 0 ? 'Cartões listados com sucesso.' : 'Nenhum cartão salvo encontrado.'
            });
        } catch (error: any) {
            logger.error({ error: error.message }, 'CardManagementController::listSavedCards()');
            return res.status(500).json({ msg: 'Erro ao listar cartões salvos.', error: error.message });
        }
    }

    static async setDefaultCard(req: any, res: Response) {
        try {
            const { cardId } = req.body;
            const { garageId } = req.user;

            if (!cardId) {
                return res.status(400).json({ msg: 'ID do cartão é obrigatório.' });
            }

            const result = await CreditCardTokenService.setDefaultCard(cardId, garageId);

            if (!result) {
                return res.status(404).json({ msg: 'Cartão não encontrado.' });
            }

            return res.status(200).json({ msg: 'Cartão definido como padrão com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'CardManagementController::setDefaultCard()');
            return res.status(500).json({ msg: 'Erro ao definir cartão padrão.', error: error.message });
        }
    }

    static async deleteCard(req: any, res: Response) {
        try {
            const { cardId } = req.body;
            const { garageId } = req.user;

            if (!cardId) {
                return res.status(400).json({ msg: 'ID do cartão é obrigatório.' });
            }

            const result = await CreditCardTokenService.deleteCard(cardId, garageId);

            if (!result) {
                return res.status(404).json({ msg: 'Cartão não encontrado.' });
            }

            return res.status(200).json({ msg: 'Cartão removido com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'CardManagementController::deleteCard()');
            return res.status(500).json({ msg: 'Erro ao remover cartão.', error: error.message });
        }
    }
}

export default CardManagementController;