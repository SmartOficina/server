import { Request, Response } from "express";
import { StatisticsService } from "./statistics-service";
import logger from "../../logger";

const statisticsService = new StatisticsService();

interface AuthRequest extends Request {
  user?: {
    garageId: string;
    userId: string;
    [key: string]: any;
  };
}

export class StatisticsController {
  async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { garageId } = req.user || {};

      if (!garageId) {
        res.status(400).json({
          error: "Garage ID is required",
        });
        return;
      }

      const overview = await statisticsService.getOverview(garageId);

      res.status(200).json({
        result: overview,
      });
    } catch (error) {
      logger.error("Error getting overview statistics:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  }

  async getServiceOrdersStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { garageId } = req.user || {};
      const { period } = req.query;

      if (!garageId) {
        res.status(400).json({
          error: "Garage ID is required",
        });
        return;
      }

      const stats = await statisticsService.getServiceOrdersStats(garageId, period as string);

      res.status(200).json({
        result: stats,
      });
    } catch (error) {
      logger.error("Error getting service orders statistics:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  }

  async getFinancialStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { garageId } = req.user || {};
      const { period } = req.query;

      if (!garageId) {
        res.status(400).json({
          error: "Garage ID is required",
        });
        return;
      }

      const stats = await statisticsService.getFinancialStats(garageId, period as string);

      res.status(200).json({
        result: stats,
      });
    } catch (error) {
      logger.error("Error getting financial statistics:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  }

  async getOperationalStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { garageId } = req.user || {};
      const { period } = req.query;

      if (!garageId) {
        res.status(400).json({
          error: "Garage ID is required",
        });
        return;
      }

      const stats = await statisticsService.getOperationalStats(garageId, period as string);

      res.status(200).json({
        result: stats,
      });
    } catch (error) {
      logger.error("Error getting operational statistics:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  }

  async getInventoryStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { garageId } = req.user || {};

      if (!garageId) {
        res.status(400).json({
          error: "Garage ID is required",
        });
        return;
      }

      const stats = await statisticsService.getInventoryStats(garageId);

      res.status(200).json({
        result: stats,
      });
    } catch (error) {
      logger.error("Error getting inventory statistics:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  }

  async getTodaySchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { garageId } = req.user || {};

      if (!garageId) {
        res.status(400).json({
          error: "Garage ID is required",
        });
        return;
      }

      const schedule = await statisticsService.getTodaySchedule(garageId);

      res.status(200).json({
        result: schedule,
      });
    } catch (error) {
      logger.error("Error getting today schedule:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  }

  /**
   * Endpoint para API interna - Retorna contagem de usuários
   * Usado pelo Discord bot para exibir estatísticas
   */
  async getUsersCount(req: Request, res: Response): Promise<void> {
    try {
      const count = await statisticsService.getUsersCount();

      res.status(200).json({
        count,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error("Erro ao obter contagem de usuários:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  }
}

export const statisticsController = new StatisticsController();
