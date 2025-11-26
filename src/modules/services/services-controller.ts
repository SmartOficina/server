import { Response } from "express";
import ServicesService from "./services-service";
import logger from "../../logger";

class ServicesController {
  static async listServices(req: any, res: Response) {
    try {
      const { search = "", limit = 10, page = 1, sortOrder = "newest", filterPeriod = "all", filterPriceRange = "all" } = req.body;

      const { garageId } = req.user;

      const numericLimit = parseInt(limit, 10);
      const numericPage = parseInt(page, 10);

      const { services, totalPages, totalItems } = await ServicesService.listServices(search, numericLimit, numericPage, garageId, sortOrder, filterPeriod, filterPriceRange);

      res.status(200).json({
        result: services,
        totalPages,
        totalItems,
        msg: "Serviços listados com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServicesController::listServices()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createService(req: any, res: Response) {
    try {
      const { garageId } = req.user;
      const newService = await ServicesService.createService(req.body, garageId);
      res.status(200).json({ result: newService, msg: "Serviço criado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServicesController::createService()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async editService(req: any, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      const { garageId } = req.user;
      const updatedService = await ServicesService.editService(id, updateData, garageId);
      res.status(200).json({ result: updatedService, msg: "Serviço editado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServicesController::editService()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removeService(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const success = await ServicesService.removeService(id, garageId);
      res.status(200).json({ msg: "Serviço removido com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServicesController::removeService()");
      res.status(500).json({ msg: error.message });
    }
  }
}

export default ServicesController;
