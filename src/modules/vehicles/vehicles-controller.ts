import { Response } from "express";
import VehiclesService from "./vehicles-service";
import logger from "../../logger";

class VehiclesController {
  static async listVehicles(req: any, res: Response) {
    try {
      const { search = "", limit = 10, page = 1, sortOrder = "newest", filterPeriod = "all", inGarage = false } = req.body;

      const { garageId } = req.user;

      const numericLimit = parseInt(limit, 10);
      const numericPage = parseInt(page, 10);

      const { vehicles, totalPages, totalItems } = await VehiclesService.listVehicles(search, numericLimit, numericPage, garageId, sortOrder, filterPeriod, inGarage);

      res.status(200).json({ result: vehicles, totalPages, totalItems, msg: "Veículos listados com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "VehiclesController::listVehicles()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createVehicle(req: any, res: Response) {
    try {
      const { garageId } = req.user;
      const newVehicle = await VehiclesService.createVehicle(req.body, garageId);
      res.status(200).json({ result: newVehicle, msg: "Veículo criado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "VehiclesController::createVehicle()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async editVehicle(req: any, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      const { garageId } = req.user;
      const updatedVehicle = await VehiclesService.editVehicle(id, updateData, garageId);
      res.status(200).json({ result: updatedVehicle, msg: "Veículo editado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "VehiclesController::editVehicle()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removeVehicle(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const success = await VehiclesService.removeVehicle(id, garageId);
      res.status(200).json({ msg: "Veículo removido com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "VehiclesController::removeVehicle()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async getVehicleInfo(req: any, res: Response) {
    try {
      const { licensePlate } = req.params;
      const vehicleInfo = await VehiclesService.getVehicleInfoByPlate(licensePlate);
      res.status(200).json({ result: vehicleInfo, msg: "Informações do veículo obtidas com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "VehiclesController::getVehicleInfo()");
      res.status(500).json({ msg: error.message });
    }
  }
}
export default VehiclesController;
