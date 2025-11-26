import { ServiceOrderModel, ServiceOrderDocument, ServiceOrderStatus } from "./service-orders-entity";
import { removeEmptyFields } from "../../core/utils/data-utils";
import mongoose from "mongoose";

interface PopulatedServiceOrder {
  _id: string;
  vehicleId: string;
  client?: any;
  vehicle?: any;
  [key: string]: any;
}

export class ServiceOrdersModel {
  static async find(search: string, limit: number, page: number, garageId: string, status?: ServiceOrderStatus, sortOrder: string = "newest", filterPeriod: string = "all"): Promise<{ serviceOrders: any[]; totalPages: number; totalItems: number }> {
    try {
      const numericLimit = Math.max(1, Number(limit) || 10);
      const numericPage = Math.max(1, Number(page) || 1);

      const queryConditions: any = { garageId };

      if (status && Object.values(ServiceOrderStatus).includes(status)) {
        queryConditions.status = status;
      }

      if (search && search.trim()) {
        const searchTerm = search.trim();
        queryConditions.$or = [{ reportedProblem: { $regex: searchTerm, $options: "i" } }, { identifiedProblems: { $regex: searchTerm, $options: "i" } }, { technicalObservations: { $regex: searchTerm, $options: "i" } }, { invoiceNumber: { $regex: searchTerm, $options: "i" } }, { orderNumber: { $regex: searchTerm, $options: "i" } }];
      }

      if (filterPeriod && filterPeriod !== "all") {
        const dateFilter = this.buildDateFilter(filterPeriod);
        if (dateFilter) {
          queryConditions.openingDate = dateFilter;
        }
      }

      const totalServiceOrders = await ServiceOrderModel.countDocuments(queryConditions);
      const totalPages = Math.ceil(totalServiceOrders / numericLimit);

      const sortOptions = this.getSortOptions(sortOrder);
      const orders = (await ServiceOrderModel.find(queryConditions)
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .sort(sortOptions)
        .limit(numericLimit)
        .skip((numericPage - 1) * numericLimit)
        .lean()
        .exec()) as unknown as PopulatedServiceOrder[];



      for (const order of orders) {
        try {
          if (order.vehicle && order.vehicle.clientId) {
            order.client = order.vehicle.clientId;
          }
        } catch (error) {
        }
      }

      return {
        serviceOrders: orders,
        totalPages,
        totalItems: totalServiceOrders,
      };
    } catch (error) {
      throw error;
    }
  }

  private static buildDateFilter(period: string): { $gte: Date; $lte?: Date } | null {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    let startDate = new Date(now);

    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        return { $gte: startDate, $lte: endOfDay };

      case "week":
        startDate.setDate(startDate.getDate() - 7);
        return { $gte: startDate, $lte: endOfDay };

      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        return { $gte: startDate, $lte: endOfDay };

      case "semester":
        startDate.setMonth(startDate.getMonth() - 6);
        return { $gte: startDate, $lte: endOfDay };

      case "year":
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        return { $gte: startDate, $lte: endOfDay };

      default:
        return null;
    }
  }

  private static getSortOptions(sortOrder: string): any {
    switch (sortOrder) {
      case "newest":
        return { createdAt: -1 };
      case "oldest":
        return { createdAt: 1 };
      case "number_asc":
        return { orderNumber: 1 };
      case "number_desc":
        return { orderNumber: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  static async findById(id: string, garageId: string): Promise<any> {
    try {
      const order = (await ServiceOrderModel.findOne({ _id: id, garageId })
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (!order) return null;

      if (order.vehicle && order.vehicle.clientId) {
        order.client = order.vehicle.clientId;
      }

      return order;
    } catch (error) {
      return null;
    }
  }

  static async create(serviceOrderData: Partial<ServiceOrderDocument>, garageId: string): Promise<ServiceOrderDocument> {
    try {
      const sanitizedData = removeEmptyFields(serviceOrderData);

      const statusHistory = [
        {
          status: ServiceOrderStatus.OPENED,
          date: new Date(),
          notes: "Ordem de serviço criada",
        },
      ];

      const orderNumber = await this.generateOrderNumber(garageId);

      const newServiceOrder = new ServiceOrderModel({
        ...sanitizedData,
        statusHistory,
        garageId,
        status: ServiceOrderStatus.OPENED,
        openingDate: new Date(),
        orderNumber,
      });

      return newServiceOrder.save();
    } catch (error) {
      throw error;
    }
  }

  static async update(id: string, serviceOrderData: Partial<ServiceOrderDocument>, garageId: string): Promise<any> {
    try {
      if (serviceOrderData.openingDate) {
        const rawDate = new Date(serviceOrderData.openingDate);
        const fixedDate = new Date(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate(), 0, 0, 1);
        serviceOrderData.openingDate = fixedDate;
      }

      const dataWithTimestamp = {
        ...serviceOrderData,
        updatedAt: new Date(),
      };

      const currentServiceOrder = await ServiceOrderModel.findOne({ _id: id, garageId }).exec();

      if (currentServiceOrder && serviceOrderData.status && currentServiceOrder.status !== serviceOrderData.status) {
        const newStatusHistory = {
          status: serviceOrderData.status,
          date: new Date(),
          notes: serviceOrderData.statusHistory?.[0]?.notes || `Status atualizado para ${serviceOrderData.status}`,
        };

        dataWithTimestamp.statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];
      }

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate({ _id: id, garageId }, dataWithTimestamp, { new: true })
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async delete(id: string, garageId: string): Promise<boolean> {
    try {
      const result = await ServiceOrderModel.findOneAndDelete({ _id: id, garageId }).exec();
      return result !== null;
    } catch (error) {
      return false;
    }
  }

  static async updateStatus(id: string, status: ServiceOrderStatus, notes: string, garageId: string): Promise<any> {
    try {
      const currentServiceOrder = await ServiceOrderModel.findOne({ _id: id, garageId }).exec();
      if (!currentServiceOrder) return null;

      const newStatusHistory = {
        status,
        date: new Date(),
        notes: notes || `Status atualizado para ${status}`,
      };

      const statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { _id: id, garageId },
        {
          status,
          statusHistory,
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async approveBudget(id: string, garageId: string): Promise<any> {
    try {
      const currentServiceOrder = await ServiceOrderModel.findOne({ _id: id, garageId }).exec();
      if (!currentServiceOrder) return null;

      const newStatusHistory = {
        status: ServiceOrderStatus.APPROVED,
        date: new Date(),
        notes: "Orçamento aprovado pelo cliente",
      };

      const statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { _id: id, garageId },
        {
          budgetApprovalStatus: "aprovado",
          budgetApprovalDate: new Date(),
          status: ServiceOrderStatus.APPROVED,
          statusHistory,
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async rejectBudget(id: string, garageId: string): Promise<any> {
    try {
      const currentServiceOrder = await ServiceOrderModel.findOne({ _id: id, garageId }).exec();
      if (!currentServiceOrder) return null;

      const newStatusHistory = {
        status: ServiceOrderStatus.REJECTED,
        date: new Date(),
        notes: "Orçamento rejeitado pelo cliente",
      };

      const statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { _id: id, garageId },
        {
          budgetApprovalStatus: "rejeitado",
          budgetApprovalDate: new Date(),
          status: ServiceOrderStatus.REJECTED,
          statusHistory,
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async generateApprovalToken(serviceOrderId: string, expiresAt: Date): Promise<string> {
    try {
      const token = (ServiceOrderModel as any).generateBudgetApprovalToken();

      await ServiceOrderModel.findByIdAndUpdate(serviceOrderId, {
        budgetApproval: {
          token,
          createdAt: new Date(),
          expiresAt,
          used: false,
        },
      });

      return token;
    } catch (error) {
      throw error;
    }
  }

  static async findByApprovalToken(token: string): Promise<any> {
    try {
      const order = (await ServiceOrderModel.findOne({ "budgetApproval.token": token })
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (!order) return null;

      if (order.vehicle && order.vehicle.clientId) {
        order.client = order.vehicle.clientId;
      }

      return order;
    } catch (error) {
      return null;
    }
  }

  static async approveBudgetViaToken(token: string): Promise<any> {
    try {
      const currentServiceOrder: any = await ServiceOrderModel.findOne({ "budgetApproval.token": token }).exec();
      if (!currentServiceOrder) return null;

      const newStatusHistory = {
        status: ServiceOrderStatus.APPROVED,
        date: new Date(),
        notes: "Orçamento aprovado pelo cliente via link",
      };

      const statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];

      currentServiceOrder.budgetApproval.used = true;
      currentServiceOrder.budgetApproval.usedAt = new Date();
      currentServiceOrder.budgetApproval.decision = "approved";

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { "budgetApproval.token": token },
        {
          budgetApprovalStatus: "aprovado",
          budgetApprovalDate: new Date(),
          status: ServiceOrderStatus.APPROVED,
          statusHistory,
          budgetApproval: currentServiceOrder.budgetApproval,
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async rejectBudgetViaToken(token: string, reason?: string): Promise<any> {
    try {
      const currentServiceOrder: any = await ServiceOrderModel.findOne({ "budgetApproval.token": token }).exec();
      if (!currentServiceOrder) return null;

      const notes = reason ? `Orçamento rejeitado pelo cliente via link. Motivo: ${reason}` : "Orçamento rejeitado pelo cliente via link";

      const newStatusHistory = {
        status: ServiceOrderStatus.REJECTED,
        date: new Date(),
        notes,
      };

      const statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];

      currentServiceOrder.budgetApproval.used = true;
      currentServiceOrder.budgetApproval.usedAt = new Date();
      currentServiceOrder.budgetApproval.decision = "rejected";
      currentServiceOrder.budgetApproval.rejectionReason = reason;

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { "budgetApproval.token": token },
        {
          budgetApprovalStatus: "rejeitado",
          budgetApprovalDate: new Date(),
          status: ServiceOrderStatus.REJECTED,
          statusHistory,
          budgetApproval: currentServiceOrder.budgetApproval,
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async completeServiceOrder(id: string, completionData: any, garageId: string): Promise<any> {
    try {
      const currentServiceOrder = await ServiceOrderModel.findOne({ _id: id, garageId }).exec();
      if (!currentServiceOrder) return null;

      const { exitChecklist, testDrive, invoiceNumber, paymentMethod, finalTotalParts, finalTotalServices, finalTotal } = completionData;

      const newStatusHistory = {
        status: ServiceOrderStatus.COMPLETED,
        date: new Date(),
        notes: "Ordem de serviço concluída",
      };

      const statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { _id: id, garageId },
        {
          exitChecklist,
          testDrive,
          invoiceNumber,
          invoiceDate: new Date(),
          paymentMethod,
          finalTotalParts,
          finalTotalServices,
          finalTotal,
          completionDate: new Date(),
          status: ServiceOrderStatus.COMPLETED,
          statusHistory,
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async deliverVehicle(id: string, garageId: string): Promise<any> {
    try {
      const currentServiceOrder = await ServiceOrderModel.findOne({ _id: id, garageId }).exec();
      if (!currentServiceOrder) return null;

      const newStatusHistory = {
        status: ServiceOrderStatus.DELIVERED,
        date: new Date(),
        notes: "Veículo entregue ao cliente",
      };

      const statusHistory = [newStatusHistory, ...(currentServiceOrder.statusHistory || [])];

      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { _id: id, garageId },
        {
          deliveryDate: new Date(),
          status: ServiceOrderStatus.DELIVERED,
          statusHistory,
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async addMechanicWork(id: string, mechanicWork: any, garageId: string): Promise<any> {
    try {
      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        { _id: id, garageId },
        {
          $push: { mechanicWorks: mechanicWork },
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  static async updateMechanicWork(id: string, mechanicWorkId: string, updatedWork: any, garageId: string): Promise<any> {
    try {
      const updatedOrder = (await ServiceOrderModel.findOneAndUpdate(
        {
          _id: id,
          garageId,
          "mechanicWorks._id": mechanicWorkId,
        },
        {
          $set: { "mechanicWorks.$": updatedWork },
          updatedAt: new Date(),
        },
        { new: true }
      )
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder;

      if (updatedOrder && updatedOrder.vehicle && updatedOrder.vehicle.clientId) {
        updatedOrder.client = updatedOrder.vehicle.clientId;
      }

      return updatedOrder;
    } catch (error) {
      return null;
    }
  }

  private static async generateOrderNumber(garageId: string): Promise<string> {
    try {
      const lastOrder: any = await ServiceOrderModel.findOne({ garageId }, { orderNumber: 1 }).sort({ _id: -1 }).limit(1).exec();

      if (!lastOrder || !lastOrder.orderNumber) {
        return "AA0001";
      }

      const lastOrderNumber = lastOrder.orderNumber;
      const prefix = lastOrderNumber.replace(/[0-9]/g, "");
      const number = parseInt(lastOrderNumber.replace(/[^0-9]/g, ""));

      let nextNumber = number + 1;

      if (nextNumber > 9999) {
        nextNumber = 1;
        const prefixChars = prefix.split("");

        let incrementPosition = prefix.length - 1;
        let carry = true;

        while (carry && incrementPosition >= 0) {
          const currentChar = prefixChars[incrementPosition];
          const nextChar = currentChar === "Z" ? "A" : String.fromCharCode(currentChar.charCodeAt(0) + 1);
          prefixChars[incrementPosition] = nextChar;
          carry = nextChar === "A";
          incrementPosition--;
        }

        if (carry) {
          prefixChars.unshift("A");
        }

        const nextPrefix = prefixChars.join("");
        return `${nextPrefix}${nextNumber.toString().padStart(4, "0")}`;
      }

      return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
    } catch (error) {
      throw error;
    }
  }

  static async findByVehicle(vehicleId: string, garageId: string): Promise<any[]> {
    try {
      const orders = (await ServiceOrderModel.find({
        vehicleId,
        garageId,
      })
        .sort({ openingDate: -1 })
        .populate({
          path: "vehicle",
          populate: {
            path: "clientId",
            model: "Client",
          },
        })
        .lean()
        .exec()) as unknown as PopulatedServiceOrder[];

      for (const order of orders) {
        if (order.vehicle && order.vehicle.clientId) {
          order.client = order.vehicle.clientId;
        }
      }

      return orders;
    } catch (error) {
      return [];
    }
  }
}
