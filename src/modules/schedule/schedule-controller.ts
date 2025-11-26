import { Response } from 'express';
import ScheduleService from './schedule-service';
import logger from '../../logger';

class ScheduleController {
    static async listEvents(req: any, res: Response) {
        try {
            const { startDate, endDate } = req.body;
            const { garageId } = req.user;

            if (!startDate || !endDate) {
                return res.status(400).json({ msg: 'As datas de início e fim são obrigatórias.' });
            }

            const { events, totalItems } = await ScheduleService.listEvents(startDate, endDate, garageId);
            res.status(200).json({ result: events, totalItems, msg: 'Eventos listados com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'ScheduleController::listEvents()');
            res.status(500).json({ msg: error.message });
        }
    }

    static async createEvent(req: any, res: Response) {
        try {
            const { garageId } = req.user;

            if (!req.body.title || !req.body.date || !req.body.time || !req.body.serviceTag) {
                return res.status(400).json({
                    msg: 'Dados incompletos. Título, data, hora e etiqueta de serviço são obrigatórios.'
                });
            }

            const newEvent = await ScheduleService.createEvent(req.body, garageId);
            res.status(200).json({ result: newEvent, msg: 'Agendamento criado com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'ScheduleController::createEvent()');
            res.status(500).json({ msg: error.message });
        }
    }

    static async updateEvent(req: any, res: Response) {
        try {
            const { id, ...updateData } = req.body;
            const { garageId } = req.user;

            if (!id) {
                return res.status(400).json({ msg: 'O ID do agendamento é obrigatório.' });
            }

            const updatedEvent = await ScheduleService.updateEvent(id, updateData, garageId);

            if (!updatedEvent) {
                return res.status(404).json({ msg: 'Agendamento não encontrado.' });
            }

            res.status(200).json({ result: updatedEvent, msg: 'Agendamento atualizado com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'ScheduleController::updateEvent()');
            res.status(500).json({ msg: error.message });
        }
    }

    static async removeEvent(req: any, res: Response) {
        try {
            const { id } = req.body;
            const { garageId } = req.user;

            if (!id) {
                return res.status(400).json({ msg: 'O ID do agendamento é obrigatório.' });
            }

            const success = await ScheduleService.removeEvent(id, garageId);

            if (!success) {
                return res.status(404).json({ msg: 'Agendamento não encontrado.' });
            }

            res.status(200).json({ msg: 'Agendamento removido com sucesso.' });
        } catch (error: any) {
            logger.error({ error: error.message }, 'ScheduleController::removeEvent()');
            res.status(500).json({ msg: error.message });
        }
    }

    static async updateEventStatus(req: any, res: Response) {
        try {
            const { id, status } = req.body;
            const { garageId } = req.user;

            if (!id || !status) {
                return res.status(400).json({ msg: 'O ID e o status do agendamento são obrigatórios.' });
            }

            const updatedEvent = await ScheduleService.updateEventStatus(id, status, garageId);

            if (!updatedEvent) {
                return res.status(404).json({ msg: 'Agendamento não encontrado.' });
            }

            res.status(200).json({
                result: updatedEvent,
                msg: 'Status do agendamento atualizado com sucesso.'
            });
        } catch (error: any) {
            logger.error({ error: error.message }, 'ScheduleController::updateEventStatus()');
            res.status(500).json({ msg: error.message });
        }
    }
}

export default ScheduleController;