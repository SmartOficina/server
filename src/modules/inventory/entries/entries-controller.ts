import { Response } from "express";
import logger from "../../../logger";
import InventoryEntriesService from "./entries-service";
import ServiceOrdersService from "../../service-orders/service-orders-service";

class InventoryEntriesController {
  static async listEntries(req: any, res: Response) {
    try {
      const { search = "", limit, page, partId, supplierId, movementType, startDate, endDate } = req.query;

      const parsedLimit = parseInt(limit as string) || 10;
      const parsedPage = parseInt(page as string) || 1;
      const { garageId } = req.user;

      let result;
      if (partId) {
        result = await InventoryEntriesService.listEntriesByPart(partId, parsedLimit, parsedPage, garageId);
      } else if (supplierId) {
        result = await InventoryEntriesService.listEntriesBySupplier(supplierId, parsedLimit, parsedPage, garageId);
      } else {
        result = await InventoryEntriesService.listEntries(search, parsedLimit, parsedPage, garageId, movementType, startDate, endDate);
      }

      const { entries, totalPages, totalItems } = result;

      const enrichedEntries = await Promise.all(
        entries.map(async (entry) => {
          const entryObj = entry.toObject ? entry.toObject() : entry;

          if (entryObj.movementType === "exit" && entryObj.exitType === "service_order" && entryObj.reference) {
            const serviceOrder = await ServiceOrdersService.getServiceOrderById(entryObj.reference, garageId);
            return { ...entryObj, serviceOrder };
          }

          return entryObj;
        })
      );

      res.status(200).json({
        result: enrichedEntries,
        totalPages,
        totalItems,
        msg: "Movimentações de estoque listadas com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "InventoryEntriesController::listEntries()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createEntry(req: any, res: Response) {
    try {
      const { garageId } = req.user;
      const newEntry = await InventoryEntriesService.createEntry(req.body, garageId);
      res.status(200).json({ result: newEntry, msg: "Lançamento de estoque criado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "InventoryEntriesController::createEntry()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async editEntry(req: any, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      const { garageId } = req.user;
      const updatedEntry = await InventoryEntriesService.editEntry(id, updateData, garageId);

      if (!updatedEntry) {
        return res.status(404).json({ msg: "Lançamento de estoque não encontrado" });
      }

      res.status(200).json({ result: updatedEntry, msg: "Lançamento de estoque editado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "InventoryEntriesController::editEntry()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removeEntry(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;

      if (!id) {
        return res.status(400).json({ msg: "ID é obrigatório" });
      }

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ msg: "ID inválido" });
      }

      const success = await InventoryEntriesService.removeEntry(id, garageId);

      if (!success) {
        return res.status(404).json({ msg: "Movimentação não encontrada" });
      }

      res.status(200).json({ msg: "Movimentação removida com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "InventoryEntriesController::removeEntry()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createManualExit(req: any, res: Response) {
    try {
      const { garageId } = req.user;
      const { partId, quantity, description, exitType, reference, costPrice, sellingPrice } = req.body;

      if (!partId || !quantity || !description || !exitType) {
        return res.status(400).json({ msg: "Campos obrigatórios: partId, quantity, description, exitType" });
      }

      if (quantity <= 0) {
        return res.status(400).json({ msg: "Quantidade deve ser maior que zero" });
      }

      const exit = await InventoryEntriesService.createManualExit(
        {
          partId,
          quantity: parseInt(quantity),
          description,
          exitType,
          reference,
          costPrice,
          sellingPrice,
        },
        garageId
      );

      res.status(200).json({
        result: exit,
        msg: "Saída registrada com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "InventoryEntriesController::createManualExit()");

      if (error.message.includes("não encontrada") || error.message.includes("insuficiente")) {
        res.status(400).json({ msg: error.message });
      } else {
        res.status(500).json({ msg: error.message });
      }
    }
  }
}

export default InventoryEntriesController;
