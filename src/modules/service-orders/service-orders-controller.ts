import { Response } from "express";
import ServiceOrdersService from "./service-orders-service";
import { ServiceOrderStatus, PaymentMethod } from "./service-orders-entity";
import logger from "../../logger";
import { InventoryService } from "../inventory/inventory-service";
import { ServiceOrdersModel } from "./service-orders-model";

class ServiceOrdersController {
  static async listServiceOrders(req: any, res: Response) {
    try {
      const { search = "", limit = 10, page = 1, status, sortOrder = "newest", filterPeriod = "all" } = req.body;

      const { garageId } = req.user;

      const statusFilter = status === "all" ? undefined : status;

      const { serviceOrders, totalPages, totalItems } = await ServiceOrdersService.listServiceOrders(search, Number(limit), Number(page), garageId, statusFilter, sortOrder, filterPeriod);

      res.status(200).json({
        result: serviceOrders,
        totalPages,
        totalItems,
        msg: "Ordens de Serviço listadas com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::listServiceOrders()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async getServiceOrderById(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { garageId } = req.user;
      const serviceOrder = await ServiceOrdersService.getServiceOrderById(id, garageId);

      if (!serviceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: serviceOrder, msg: "Ordem de Serviço obtida com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::getServiceOrderById()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async createServiceOrder(req: any, res: Response) {
    try {
      const { garageId } = req.user;

      if (!req.body.vehicleId) {
        return res.status(400).json({ msg: "Veículo é obrigatório para criar uma Ordem de Serviço" });
      }

      if (!req.body.reportedProblem) {
        return res.status(400).json({ msg: "O problema relatado pelo cliente é obrigatório" });
      }

      const newServiceOrder = await ServiceOrdersService.createServiceOrder(req.body, garageId);
      res.status(200).json({ result: newServiceOrder, msg: "Ordem de Serviço criada com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::createServiceOrder()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async updateServiceOrder(req: any, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      const { garageId } = req.user;
      const updatedServiceOrder = await ServiceOrdersService.updateServiceOrder(id, updateData, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Ordem de Serviço atualizada com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::updateServiceOrder()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async removeServiceOrder(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const success = await ServiceOrdersService.removeServiceOrder(id, garageId);

      if (!success) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ msg: "Ordem de Serviço removida com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::removeServiceOrder()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async approveBudget(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const updatedServiceOrder = await ServiceOrdersService.approveBudget(id, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Orçamento aprovado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::approveBudget()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async rejectBudget(req: any, res: Response) {
    try {
      const { id } = req.body;
      const { garageId } = req.user;
      const updatedServiceOrder = await ServiceOrdersService.rejectBudget(id, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Orçamento rejeitado" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::rejectBudget()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async generateBudgetApprovalLink(req: any, res: Response) {
    try {
      const { serviceOrderId } = req.body;
      const { garageId } = req.user;

      const result = await ServiceOrdersService.generateBudgetApprovalLink(serviceOrderId, garageId);

      res.status(200).json({
        approvalLink: result.approvalLink,
        msg: "Link de aprovação do orçamento gerado com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::generateBudgetApprovalLink()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async getBudgetApprovalDetails(req: any, res: Response) {
    try {
      const { token } = req.params;

      const result = await ServiceOrdersService.getBudgetApprovalDetailsByToken(token);

      res.status(200).json(result);
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::getBudgetApprovalDetails()");
      res.status(404).json({ msg: error.message });
    }
  }

  static async approveBudgetExternal(req: any, res: Response) {
    try {
      const { token } = req.body;

      const updatedServiceOrder = await ServiceOrdersService.approveBudgetViaToken(token);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Link de aprovação inválido ou expirado" });
      }

      res.status(200).json({
        result: updatedServiceOrder,
        msg: "Orçamento aprovado com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::approveBudgetExternal()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async rejectBudgetExternal(req: any, res: Response) {
    try {
      const { token, reason } = req.body;

      const updatedServiceOrder = await ServiceOrdersService.rejectBudgetViaToken(token, reason);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Link de aprovação inválido ou expirado" });
      }

      res.status(200).json({
        result: updatedServiceOrder,
        msg: "Orçamento rejeitado com sucesso",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::rejectBudgetExternal()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async completeServiceOrder(req: any, res: Response) {
    try {
      const { id, exitChecklist, testDrive, invoiceNumber, paymentMethod, finalTotalParts, finalTotalServices, finalTotal } = req.body;
      const { garageId } = req.user;

      if (paymentMethod && !Object.values(PaymentMethod).includes(paymentMethod)) {
        return res.status(400).json({ msg: "Método de pagamento inválido" });
      }

      const completionData = {
        exitChecklist,
        testDrive,
        invoiceNumber,
        paymentMethod: paymentMethod || PaymentMethod.CASH,
        finalTotalParts,
        finalTotalServices,
        finalTotal,
      };

      const updatedServiceOrder = await ServiceOrdersService.completeServiceOrder(id, completionData, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Ordem de Serviço concluída com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::completeServiceOrder()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async deliverVehicle(req: any, res: Response) {
    try {
      const { id, paymentMethod, invoiceNumber } = req.body;
      const { garageId } = req.user;
      
      // Valida o método de pagamento se fornecido
      if (paymentMethod && !Object.values(PaymentMethod).includes(paymentMethod)) {
        return res.status(400).json({ msg: "Método de pagamento inválido" });
      }
      
      const updatedServiceOrder = await ServiceOrdersService.deliverVehicle(id, garageId, paymentMethod as PaymentMethod, invoiceNumber);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Veículo entregue com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::deliverVehicle()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async addMechanicWork(req: any, res: Response) {
    try {
      const { id, mechanicId, startTime, endTime, notes } = req.body;
      const { garageId } = req.user;

      const mechanicWork = {
        mechanicId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        notes,
      };

      const updatedServiceOrder = await ServiceOrdersService.addMechanicWork(id, mechanicWork, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Registro de trabalho adicionado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::addMechanicWork()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async updateMechanicWork(req: any, res: Response) {
    try {
      const { id, mechanicWorkId, mechanicId, startTime, endTime, notes } = req.body;
      const { garageId } = req.user;

      const updatedWork = {
        mechanicId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        notes,
      };

      const updatedServiceOrder = await ServiceOrdersService.updateMechanicWork(id, mechanicWorkId, updatedWork, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço ou registro de trabalho não encontrado" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Registro de trabalho atualizado com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::updateMechanicWork()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async generateDiagnosticAndBudget(req: any, res: Response) {
    try {
      const { id, identifiedProblems, requiredParts, services, estimatedCompletionDate, technicalObservations } = req.body;
      const { garageId } = req.user;

      if (!estimatedCompletionDate) {
        return res.status(400).json({ msg: "O campo 'Previsão de Conclusão' é obrigatório" });
      }

      const diagnosticData = {
        identifiedProblems,
        requiredParts,
        services,
        estimatedCompletionDate: new Date(estimatedCompletionDate),
        technicalObservations,
      };

      const updatedServiceOrder = await ServiceOrdersService.generateDiagnosticAndBudget(id, diagnosticData, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      res.status(200).json({ result: updatedServiceOrder, msg: "Diagnóstico e orçamento gerados com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::generateDiagnosticAndBudget()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async getVehicleHistory(req: any, res: Response) {
    try {
      const { vehicleId } = req.body;
      const { garageId } = req.user;
      const history = await ServiceOrdersService.getVehicleHistory(vehicleId, garageId);
      res.status(200).json({ result: history, msg: "Histórico do veículo obtido com sucesso" });
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::getVehicleHistory()");
      res.status(500).json({ msg: error.message });
    }
  }

  static async updateStatus(req: any, res: Response) {
    try {
      const { id, status, notes } = req.body;
      const { garageId } = req.user;

      if (!Object.values(ServiceOrderStatus).includes(status)) {
        return res.status(400).json({ msg: "Status inválido" });
      }

      const currentServiceOrder = await ServiceOrdersModel.findById(id, garageId);
      if (!currentServiceOrder) {
        return res.status(404).json({ msg: "Ordem de Serviço não encontrada" });
      }

      const oldStatus = currentServiceOrder.status;
      const newStatus = status;

      const updatedServiceOrder = await ServiceOrdersService.updateServiceOrderStatus(id, status, notes, garageId);

      if (!updatedServiceOrder) {
        return res.status(404).json({ msg: "Erro ao atualizar status da Ordem de Serviço" });
      }

      try {
        await ServiceOrdersController.handleInventoryChanges(id, oldStatus, newStatus, garageId);

        res.status(200).json({
          result: updatedServiceOrder,
          msg: "Status da Ordem de Serviço atualizado com sucesso",
        });
      } catch (inventoryError: any) {
        logger.error({ error: inventoryError.message }, "ServiceOrdersController::updateStatus - Erro no estoque, revertendo status");

        await ServiceOrdersService.updateServiceOrderStatus(id, oldStatus, `Status revertido automaticamente devido a erro no estoque: ${inventoryError.message}`, garageId);

        res.status(400).json({
          msg: `Erro ao atualizar estoque: ${inventoryError.message}`,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::updateStatus()");
      res.status(500).json({ msg: error.message });
    }
  }

  private static async handleInventoryChanges(serviceOrderId: string, oldStatus: ServiceOrderStatus, newStatus: ServiceOrderStatus, garageId: string): Promise<void> {
    try {
      const nonAffectingStatuses = [ServiceOrderStatus.OPENED, ServiceOrderStatus.DIAGNOSING, ServiceOrderStatus.WAITING_APPROVAL, ServiceOrderStatus.APPROVED, ServiceOrderStatus.REJECTED];

      const affectingStatuses = [ServiceOrderStatus.IN_PROGRESS, ServiceOrderStatus.WAITING_PARTS, ServiceOrderStatus.COMPLETED, ServiceOrderStatus.DELIVERED];

      if (nonAffectingStatuses.includes(oldStatus) && affectingStatuses.includes(newStatus)) {
        logger.info(`Consumindo peças para OS ${serviceOrderId} (${oldStatus} -> ${newStatus})`);
        await InventoryService.consumePartsFromServiceOrder(serviceOrderId, garageId);
      } else if (affectingStatuses.includes(oldStatus) && nonAffectingStatuses.includes(newStatus)) {
        logger.info(`Restaurando peças para OS ${serviceOrderId} (${oldStatus} -> ${newStatus})`);
        await InventoryService.restorePartsToServiceOrder(serviceOrderId, garageId);
      } else {
        logger.info(`Alteração de status sem efeito no estoque para OS ${serviceOrderId} (${oldStatus} -> ${newStatus})`);
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "ServiceOrdersController::handleInventoryChanges()");
      throw error;
    }
  }
}

export default ServiceOrdersController;
