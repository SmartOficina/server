import { Response } from "express";
import SuppliersService from "./suppliers-service";
import logger from "../../../logger";

class SuppliersController {
  static async listSuppliers(req: any, res: Response) {
    try {
      const { search = "", limit = 10, page = 1, filterPeriod = "all", filterState = "all", sortOrder = "name" } = req.body;
      const { garageId } = req.user;
      const { suppliers, totalPages, totalItems } = await SuppliersService.listSuppliers(search, limit, page, garageId, filterPeriod, filterState, sortOrder);
      res.status(200).json({ result: suppliers, totalPages, totalItems, msg: "Fornecedores listados com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "SuppliersController::listSuppliers()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async getSupplier(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const supplier = await SuppliersService.getSupplierById(id, garageId);

      if (!supplier) {
        return res.status(404).json({ msg: "Fornecedor não encontrado" });
      }

      res.status(200).json({ result: supplier, msg: "Fornecedor encontrado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "SuppliersController::getSupplier()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createSupplier(req: any, res: Response) {
    try {
      const { garageId } = req.user;
      const newSupplier = await SuppliersService.createSupplier(req.body, garageId);
      res.status(200).json({ result: newSupplier, msg: "Fornecedor criado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "SuppliersController::createSupplier()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async editSupplier(req: any, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      const { garageId } = req.user;
      const updatedSupplier = await SuppliersService.editSupplier(id, updateData, garageId);

      if (!updatedSupplier) {
        return res.status(404).json({ msg: "Fornecedor não encontrado" });
      }

      res.status(200).json({ result: updatedSupplier, msg: "Fornecedor editado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "SuppliersController::editSupplier()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removeSupplier(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const success = await SuppliersService.removeSupplier(id, garageId);

      if (!success) {
        return res.status(404).json({ msg: "Fornecedor não encontrado" });
      }

      res.status(200).json({ msg: "Fornecedor removido com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "SuppliersController::removeSupplier()");
      res.status(500).json({ msg: error.message });
    }
  }
}

export default SuppliersController;
