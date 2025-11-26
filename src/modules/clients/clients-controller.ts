import { Response } from "express";
import ClientsService from "./clients-service";
import logger from "../../logger";

class ClientsController {
  static async listClients(req: any, res: Response) {
    try {
      const { search = "", limit = 10, page = 1, sortOrder = "newest", filterPeriod = "all", filterVehicleStatus = "all" } = req.body;

      const { garageId } = req.user;

      const numericLimit = parseInt(limit, 10);
      const numericPage = parseInt(page, 10);

      const { clients, totalPages, totalItems } = await ClientsService.listClients(search, numericLimit, numericPage, garageId, sortOrder, filterPeriod, filterVehicleStatus);

      res.status(200).json({ result: clients, totalPages, totalItems, msg: "Clientes listados com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ClientsController::listClients()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createClient(req: any, res: Response) {
    try {
      const { garageId } = req.user;
      const newClient = await ClientsService.createClient(req.body, garageId);
      res.status(200).json({ result: newClient, msg: "Cliente criado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ClientsController::createClient()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async editClient(req: any, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      const { garageId } = req.user;
      const updatedClient = await ClientsService.editClient(id, updateData, garageId);
      res.status(200).json({ result: updatedClient, msg: "Cliente editado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ClientsController::editClient()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removeClient(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const success = await ClientsService.removeClient(id, garageId);
      res.status(200).json({ msg: "Cliente removido com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ClientsController::removeClient()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async updateClientPhoto(req: any, res: Response) {
    try {
      const { id, photoBase64 } = req.body;
      const { garageId } = req.user;
      const updatedClient = await ClientsService.updateClientPhoto(id, photoBase64, garageId);
      res.status(200).json({ result: updatedClient, msg: "Foto do cliente atualizada com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ClientsController::updateClientPhoto()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removeClientPhoto(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const updatedClient = await ClientsService.removeClientPhoto(id, garageId);
      res.status(200).json({ result: updatedClient, msg: "Foto do cliente removida com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ClientsController::removeClientPhoto()");
      res.status(500).json({ msg: error.message });
    }
  }
}
export default ClientsController;
