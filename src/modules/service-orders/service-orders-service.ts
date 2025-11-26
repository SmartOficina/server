import { ServiceOrdersModel } from "./service-orders-model";
import { ServiceOrderDocument, ServiceOrderStatus, PaymentMethod } from "./service-orders-entity";
import { VehicleModel } from "../vehicles/vehicles-entity";

class ServiceOrdersService {
  static async listServiceOrders(search: string, limit: number, page: number, garageId: string, status?: ServiceOrderStatus, sortOrder: string = "newest", filterPeriod: string = "all"): Promise<{ serviceOrders: any[]; totalPages: number; totalItems: number }> {
    const numericLimit = Number(limit) || 10;
    const numericPage = Number(page) || 1;

    return await ServiceOrdersModel.find(search, numericLimit, numericPage, garageId, status, sortOrder, filterPeriod);
  }

  static async getServiceOrderById(id: string, garageId: string): Promise<ServiceOrderDocument | null> {
    return await ServiceOrdersModel.findById(id, garageId);
  }

  static async createServiceOrder(serviceOrderData: Partial<ServiceOrderDocument>, garageId: string): Promise<ServiceOrderDocument> {
    const vehicleExists = await VehicleModel.findOne({
      _id: serviceOrderData.vehicleId,
      garageId,
    }).exec();

    if (!vehicleExists) {
      throw new Error("Veículo não encontrado na sua oficina.");
    }

    return await ServiceOrdersModel.create(serviceOrderData, garageId);
  }

  static async updateServiceOrder(id: string, serviceOrderData: Partial<ServiceOrderDocument>, garageId: string): Promise<ServiceOrderDocument | null> {
    if (serviceOrderData.vehicleId) {
      const vehicleExists = await VehicleModel.findOne({
        _id: serviceOrderData.vehicleId,
        garageId,
      }).exec();

      if (!vehicleExists) {
        throw new Error("Veículo não encontrado na sua oficina.");
      }
    }

    return await ServiceOrdersModel.update(id, serviceOrderData, garageId);
  }

  static async removeServiceOrder(id: string, garageId: string): Promise<boolean> {
    return await ServiceOrdersModel.delete(id, garageId);
  }

  static async updateServiceOrderStatus(id: string, status: ServiceOrderStatus, notes: string, garageId: string): Promise<ServiceOrderDocument | null> {
    return await ServiceOrdersModel.updateStatus(id, status, notes, garageId);
  }

  static async approveBudget(id: string, garageId: string): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findById(id, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (serviceOrder.status !== ServiceOrderStatus.WAITING_APPROVAL) {
      throw new Error("Ordem de Serviço não está aguardando aprovação do orçamento.");
    }

    return await ServiceOrdersModel.approveBudget(id, garageId);
  }

  static async rejectBudget(id: string, garageId: string): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findById(id, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (serviceOrder.status !== ServiceOrderStatus.WAITING_APPROVAL) {
      throw new Error("Ordem de Serviço não está aguardando aprovação do orçamento.");
    }

    return await ServiceOrdersModel.rejectBudget(id, garageId);
  }

  static async generateBudgetApprovalLink(serviceOrderId: string, garageId: string): Promise<{ approvalLink: string }> {
    const serviceOrder = await ServiceOrdersModel.findById(serviceOrderId, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (serviceOrder.status !== ServiceOrderStatus.WAITING_APPROVAL) {
      throw new Error("Orçamento não está aguardando aprovação.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const token = await ServiceOrdersModel.generateApprovalToken(serviceOrderId, expiresAt);

    const approvalLink = `${process.env.NODE_ENV === "prod" ? "https://smartoficina.com.br" : "http://localhost:4200"}/approval/${token}`;

    return { approvalLink };
  }

  static async getBudgetApprovalDetailsByToken(token: string): Promise<any> {
    const serviceOrder = await ServiceOrdersModel.findByApprovalToken(token);
    if (!serviceOrder) {
      throw new Error("Link de aprovação inválido ou expirado.");
    }

    if (serviceOrder.budgetApproval && serviceOrder.budgetApproval.expiresAt < new Date()) {
      throw new Error("Link de aprovação expirado.");
    }

    if (serviceOrder.budgetApproval && serviceOrder.budgetApproval.used) {
      return {
        serviceOrder,
        budgetDetails: {
          total: serviceOrder.estimatedTotal,
        },
        approvalPending: false,
      };
    }

    return {
      serviceOrder,
      budgetDetails: {
        total: serviceOrder.estimatedTotal,
      },
      approvalPending: true,
    };
  }

  static async approveBudgetViaToken(token: string): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findByApprovalToken(token);
    if (!serviceOrder) {
      throw new Error("Link de aprovação inválido ou expirado.");
    }

    if (serviceOrder.budgetApproval && serviceOrder.budgetApproval.expiresAt < new Date()) {
      throw new Error("Link de aprovação expirado.");
    }

    if (serviceOrder.budgetApproval && serviceOrder.budgetApproval.used) {
      throw new Error("Este orçamento já foi aprovado ou rejeitado.");
    }

    return await ServiceOrdersModel.approveBudgetViaToken(token);
  }

  static async rejectBudgetViaToken(token: string, reason?: string): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findByApprovalToken(token);
    if (!serviceOrder) {
      throw new Error("Link de aprovação inválido ou expirado.");
    }

    if (serviceOrder.budgetApproval && serviceOrder.budgetApproval.expiresAt < new Date()) {
      throw new Error("Link de aprovação expirado.");
    }

    if (serviceOrder.budgetApproval && serviceOrder.budgetApproval.used) {
      throw new Error("Este orçamento já foi aprovado ou rejeitado.");
    }

    return await ServiceOrdersModel.rejectBudgetViaToken(token, reason);
  }

  static async completeServiceOrder(
    id: string,
    completionData: {
      exitChecklist: any[];
      testDrive: {
        performed: boolean;
        date?: Date;
        notes?: string;
      };
      invoiceNumber: string;
      paymentMethod: PaymentMethod;
      finalTotalParts: number;
      finalTotalServices: number;
      finalTotal: number;
    },
    garageId: string
  ): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findById(id, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (serviceOrder.status !== ServiceOrderStatus.IN_PROGRESS && serviceOrder.status !== ServiceOrderStatus.APPROVED && serviceOrder.status !== ServiceOrderStatus.WAITING_PARTS) {
      throw new Error("Ordem de Serviço não está em andamento, aprovada ou aguardando peças.");
    }

    if (!completionData.paymentMethod) {
      completionData.paymentMethod = PaymentMethod.CASH;
    }

    return await ServiceOrdersModel.completeServiceOrder(id, completionData, garageId);
  }

  static async deliverVehicle(id: string, garageId: string, paymentMethod?: PaymentMethod, invoiceNumber?: string): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findById(id, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (serviceOrder.status !== ServiceOrderStatus.COMPLETED) {
      throw new Error("Ordem de Serviço não está concluída.");
    }

    // Se o paymentMethod for passado, atualiza a ordem de serviço
    if (paymentMethod) {
      await ServiceOrdersModel.update(id, { paymentMethod, invoiceNumber }, garageId);
    }

    // Verifica se há método de pagamento (seja o já existente ou o recém-atualizado)
    const finalPaymentMethod = paymentMethod || serviceOrder.paymentMethod;
    if (!finalPaymentMethod) {
      throw new Error("Selecione um método de pagamento antes de registrar a entrega.");
    }

    return await ServiceOrdersModel.deliverVehicle(id, garageId);
  }

  static async addMechanicWork(
    id: string,
    mechanicWork: {
      mechanicId: string;
      startTime: Date;
      endTime?: Date;
      totalHours?: number;
      notes?: string;
    },
    garageId: string
  ): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findById(id, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (serviceOrder.status !== ServiceOrderStatus.IN_PROGRESS && serviceOrder.status !== ServiceOrderStatus.APPROVED) {
      throw new Error("Ordem de Serviço não está em andamento ou aprovada.");
    }

    if (mechanicWork.startTime && mechanicWork.endTime) {
      const startTime = new Date(mechanicWork.startTime).getTime();
      const endTime = new Date(mechanicWork.endTime).getTime();
      const differenceInMs = endTime - startTime;
      const differenceInHours = differenceInMs / (1000 * 60 * 60);
      mechanicWork.totalHours = parseFloat(differenceInHours.toFixed(2));
    }

    return await ServiceOrdersModel.addMechanicWork(id, mechanicWork, garageId);
  }

  static async updateMechanicWork(
    id: string,
    mechanicWorkId: string,
    updatedWork: {
      mechanicId: string;
      startTime: Date;
      endTime?: Date;
      totalHours?: number;
      notes?: string;
    },
    garageId: string
  ): Promise<ServiceOrderDocument | null> {
    const serviceOrder = await ServiceOrdersModel.findById(id, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (updatedWork.startTime && updatedWork.endTime) {
      const startTime = new Date(updatedWork.startTime).getTime();
      const endTime = new Date(updatedWork.endTime).getTime();
      const differenceInMs = endTime - startTime;
      const differenceInHours = differenceInMs / (1000 * 60 * 60);
      updatedWork.totalHours = parseFloat(differenceInHours.toFixed(2));
    }

    return await ServiceOrdersModel.updateMechanicWork(id, mechanicWorkId, updatedWork, garageId);
  }

  static async generateDiagnosticAndBudget(
    id: string,
    diagnosticData: {
      identifiedProblems: string[];
      requiredParts: {
        description: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[];
      services: {
        description: string;
        estimatedHours: number;
        pricePerHour: number;
        totalPrice: number;
      }[];
      estimatedCompletionDate: Date;
      technicalObservations?: string;
    },
    garageId: string
  ): Promise<ServiceOrderDocument | null> {
    const serviceOrder: any = await ServiceOrdersModel.findById(id, garageId);
    if (!serviceOrder) {
      throw new Error("Ordem de Serviço não encontrada.");
    }

    if (serviceOrder.status === ServiceOrderStatus.COMPLETED || serviceOrder.status === ServiceOrderStatus.DELIVERED || serviceOrder.status === ServiceOrderStatus.CANCELED) {
      throw new Error("Não é possível modificar o orçamento de uma OS concluída, entregue ou cancelada.");
    }

    const estimatedTotalParts = diagnosticData.requiredParts.reduce((total, part) => total + part.totalPrice, 0);

    const estimatedTotalServices = diagnosticData.services.reduce((total, service) => total + service.totalPrice, 0);

    const estimatedTotal = estimatedTotalParts + estimatedTotalServices;

    const statusHistory = [
      {
        status: ServiceOrderStatus.WAITING_APPROVAL,
        date: new Date(),
        notes: "Orçamento gerado, aguardando aprovação do cliente",
      },
    ];

    if (serviceOrder.statusHistory && serviceOrder.statusHistory.length > 0) {
      statusHistory.push(...serviceOrder.statusHistory);
    }

    return await ServiceOrdersModel.update(
      id,
      {
        identifiedProblems: diagnosticData.identifiedProblems,
        requiredParts: diagnosticData.requiredParts,
        services: diagnosticData.services,
        estimatedCompletionDate: diagnosticData.estimatedCompletionDate,
        technicalObservations: diagnosticData.technicalObservations,
        estimatedTotalParts,
        estimatedTotalServices,
        estimatedTotal,
        budgetApprovalStatus: "aguardando",
        status: ServiceOrderStatus.WAITING_APPROVAL,
        statusHistory,
      },
      garageId
    );
  }

  static async getVehicleHistory(vehicleId: string, garageId: string): Promise<any> {
    try {
      const serviceOrders = await ServiceOrdersModel.findByVehicle(vehicleId, garageId);
      if (!serviceOrders || serviceOrders.length === 0) {
        return { history: [], summary: { totalServices: 0, totalParts: 0, totalOrders: 0 } };
      }

      const deliveredOrders = serviceOrders.filter((order) => order.status === ServiceOrderStatus.DELIVERED);

      let totalServices = 0;
      let totalParts = 0;

      deliveredOrders.forEach((order) => {
        if (order.finalTotalServices) {
          totalServices += order.finalTotalServices;
        } else if (order.services && order.services.length > 0) {
          const servicesTotal = order.services.reduce((sum: any, service: any) => sum + (service.totalPrice || 0), 0);
          totalServices += servicesTotal;
        }

        if (order.finalTotalParts) {
          totalParts += order.finalTotalParts;
        } else if (order.requiredParts && order.requiredParts.length > 0) {
          const partsTotal = order.requiredParts.reduce((sum: any, part: any) => sum + (part.totalPrice || 0), 0);
          totalParts += partsTotal;
        }
      });

      const history = serviceOrders.map((order) => {
        let orderServiceTotal = 0;
        if (order.services && order.services.length > 0) {
          orderServiceTotal = order.services.reduce((sum: any, service: any) => sum + (service.totalPrice || 0), 0);
        }

        let orderPartsTotal = 0;
        if (order.requiredParts && order.requiredParts.length > 0) {
          orderPartsTotal = order.requiredParts.reduce((sum: any, part: any) => sum + (part.totalPrice || 0), 0);
        }

        const finalTotalServices = order.finalTotalServices || orderServiceTotal;
        const finalTotalParts = order.finalTotalParts || orderPartsTotal;
        const client = order.client || order.clientId;

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          openingDate: order.openingDate,
          status: order.status,
          reportedProblem: order.reportedProblem || "",
          identifiedProblems: order.identifiedProblems || [],
          services: order.services || [],
          requiredParts: order.requiredParts || [],
          completionDate: order.completionDate,
          estimatedTotalParts: finalTotalParts,
          estimatedTotalServices: finalTotalServices,
          estimatedTotal: order.estimatedTotal || finalTotalParts + finalTotalServices,
          finalTotal: order.finalTotal || finalTotalParts + finalTotalServices,
          technicalObservations: order.technicalObservations || "",
          clientId: typeof order.clientId === "string" ? order.clientId : order.clientId && order.clientId._id ? order.clientId._id : "",
          client: client,
          vehicle: {
            licensePlate: order.vehicle?.licensePlate || "",
            brandModel: order.vehicle?.brandModel || "",
          },
        };
      });

      const summary = {
        totalServices,
        totalParts,
        totalOrders: serviceOrders.length,
      };

      return { history, summary };
    } catch (error) {
      throw error;
    }
  }
}

export default ServiceOrdersService;
