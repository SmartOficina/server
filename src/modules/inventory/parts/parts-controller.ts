import { Response } from "express";
import PartsService from "./parts-service";
import logger from "../../../logger";

class PartsController {
  static async listParts(req: any, res: Response) {
    try {
      const { search = "", limit = 10, page = 1, filterStockStatus = "all", filterCategory = "all", sortOrder = "name" } = req.body;
      const { garageId } = req.user;

      const numericLimit = parseInt(limit, 10);
      const numericPage = parseInt(page, 10);

      const { parts, totalPages, totalItems } = await PartsService.listParts(search, numericLimit, numericPage, garageId, filterStockStatus, filterCategory, sortOrder);

      res.status(200).json({ result: parts, totalPages, totalItems, msg: "Peças listadas com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "PartsController::listParts()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async getPart(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;

      if (!id) {
        return res.status(400).json({ msg: "ID da peça é obrigatório" });
      }

      const part = await PartsService.getPartById(id, garageId);

      if (!part) {
        return res.status(404).json({ msg: "Peça não encontrada" });
      }

      const currentStock = await PartsService.getPartStock(id, garageId);

      res.status(200).json({
        result: { ...part.toObject(), currentStock },
        msg: "Peça encontrada com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "PartsController::getPart()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createPart(req: any, res: Response) {
    try {
      const { garageId } = req.user;
      const newPart = await PartsService.createPart(req.body, garageId);
      res.status(200).json({ result: newPart, msg: "Peça criada com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "PartsController::createPart()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async editPart(req: any, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      const { garageId } = req.user;
      const updatedPart = await PartsService.editPart(id, updateData, garageId);

      if (!updatedPart) {
        return res.status(404).json({ msg: "Peça não encontrada" });
      }

      res.status(200).json({ result: updatedPart, msg: "Peça editada com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "PartsController::editPart()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removePart(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const success = await PartsService.removePart(id, garageId);

      if (!success) {
        return res.status(404).json({ msg: "Peça não encontrada" });
      }

      res.status(200).json({ msg: "Peça removida com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "PartsController::removePart()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async getPartStock(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { garageId } = req.user;

      if (!id) {
        return res.status(400).json({ msg: "ID da peça é obrigatório" });
      }

      const part = await PartsService.getPartById(id, garageId);
      if (!part) {
        return res.status(404).json({ msg: "Peça não encontrada" });
      }

      const currentStock = await PartsService.getPartStock(id, garageId);

      res.status(200).json({
        result: {
          partId: id,
          currentStock: currentStock,
          unit: part.unit,
          minimumStock: part.minimumStock || 0,
          name: part.name,
        },
        msg: "Estoque da peça obtido com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "PartsController::getPartStock()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async checkAvailability(req: any, res: Response) {
    try {
      const { parts } = req.body;
      const { garageId } = req.user;

      if (!parts || !Array.isArray(parts)) {
        return res.status(400).json({
          msg: "Lista de peças inválida",
        });
      }

      const availability = await PartsService.checkPartsAvailability(parts, garageId);

      res.status(200).json({
        result: {
          items: availability.items,
          allAvailable: availability.allAvailable,
        },
        msg: availability.allAvailable ? "Todas as peças disponíveis em estoque" : "Algumas peças estão com estoque insuficiente",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "PartsController::checkAvailability()");
      res.status(500).json({ msg: error.message });
    }
  }
}

export default PartsController;
