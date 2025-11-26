import mongoose from "mongoose";
import { ClientModel, ClientDocument } from "./clients-entity";
import { removeEmptyFields } from "../../core/utils/data-utils";
import { VehicleModel } from "../vehicles/vehicles-entity";

interface AggregatedClient extends Omit<ClientDocument, "vehicles"> {
  _id: mongoose.Types.ObjectId;
  vehicles?: any[];
  [key: string]: any;
}

interface VehicleMap {
  [clientId: string]: any[];
}

type QueryCondition = { fullName: { $regex: string; $options: string } } | { email: { $regex: string; $options: string } } | { phone: { $regex: string; $options: string } } | { cpfCnpj: { $regex: string; $options: string } } | { "address.street": { $regex: string; $options: string } } | { "address.city": { $regex: string; $options: string } } | { "address.district": { $regex: string; $options: string } } | { "address.state": { $regex: string; $options: string } } | { "address.zipCode": { $regex: string; $options: string } } | { birthDate: { $gte: Date; $lte: Date } } | { createdAt: { $gte: Date; $lte: Date } };

export class ClientsModel {
  static async find(search: string, limit: number, page: number, garageId: string, sortOrder: string = "newest", filterPeriod: string = "all", filterVehicleStatus: string = "all"): Promise<{ clients: ClientDocument[]; totalPages: number; totalItems: number }> {
    const limitNum = Math.max(1, Number(limit) || 10);
    const pageNum = Math.max(1, Number(page) || 1);

    const baseQuery: any = {
      garageId: new mongoose.Types.ObjectId(garageId),
    };

    const searchConditions = this.buildSearchConditions(search);
    if (searchConditions.length > 0) {
      baseQuery["$or"] = searchConditions;
    }

    if (filterPeriod !== "all") {
      const dateFilter = this.buildDateFilter(filterPeriod);
      if (dateFilter) {
        baseQuery["createdAt"] = dateFilter;
      }
    }

    const pipeline: any[] = [
      { $match: baseQuery },
      {
        $lookup: {
          from: "vehicles",
          localField: "_id",
          foreignField: "clientId",
          as: "vehicles",
        },
      },
    ];

    if (filterVehicleStatus !== "all") {
      if (filterVehicleStatus === "with") {
        pipeline.push({ $match: { "vehicles.0": { $exists: true } } });
      } else {
        pipeline.push({ $match: { "vehicles.0": { $exists: false } } });
      }
    }

    const countPipeline = [...pipeline, { $count: "total" }];

    const sortOptions: any = this.getSortOptions(sortOrder);
    const sortStage: any = {};

    Object.keys(sortOptions).forEach((key) => {
      sortStage[key] = sortOptions[key];
    });

    pipeline.push({ $sort: sortStage }, { $skip: (pageNum - 1) * limitNum }, { $limit: limitNum });

    const [countResult, clients] = await Promise.all([ClientModel.aggregate(countPipeline).exec(), ClientModel.aggregate(pipeline).exec()]);

    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    return { clients, totalPages, totalItems };
  }

  private static buildSearchConditions(search: string): QueryCondition[] {
    if (!search || search.trim() === "") {
      return [];
    }

    const originalSearch = search.trim();
    const normalizedSearch = originalSearch.toLowerCase();
    const numericSearch = normalizedSearch.replace(/\D/g, "");

    let dateSearch = null;
    if (normalizedSearch.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parts = normalizedSearch.split("/");
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      dateSearch = new Date(year, month, day);
    } else if (normalizedSearch.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
      dateSearch = new Date(normalizedSearch);
    }

    const queryConditions: QueryCondition[] = [{ fullName: { $regex: normalizedSearch, $options: "i" } }, { email: { $regex: normalizedSearch, $options: "i" } }, { phone: { $regex: normalizedSearch, $options: "i" } }, { cpfCnpj: { $regex: normalizedSearch, $options: "i" } }, { "address.street": { $regex: normalizedSearch, $options: "i" } }, { "address.city": { $regex: normalizedSearch, $options: "i" } }, { "address.district": { $regex: normalizedSearch, $options: "i" } }, { "address.state": { $regex: normalizedSearch, $options: "i" } }, { "address.zipCode": { $regex: normalizedSearch, $options: "i" } }];

    if (numericSearch.length >= 4) {
      queryConditions.push({ phone: { $regex: numericSearch, $options: "i" } });
      queryConditions.push({ cpfCnpj: { $regex: numericSearch, $options: "i" } });
    }

    if (dateSearch && !isNaN(dateSearch.getTime())) {
      const startOfDay = new Date(dateSearch);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateSearch);
      endOfDay.setHours(23, 59, 59, 999);

      queryConditions.push({ birthDate: { $gte: startOfDay, $lte: endOfDay } });
    }

    return queryConditions;
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

  private static getSortOptions(sortOrder: string): Record<string, 1 | -1> {
    switch (sortOrder) {
      case "newest":
        return { createdAt: -1 };
      case "oldest":
        return { createdAt: 1 };
      case "name":
        return { fullName: 1 };
      case "name_desc":
        return { fullName: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  static findDuplicate(conditions: { [key: string]: string }[], garageId: string): Promise<ClientDocument | null> {
    const validConditions = conditions.filter((condition) => {
      const value = Object.values(condition)[0];
      return value !== undefined && value !== null && value !== "";
    });
    if (validConditions.length === 0) return Promise.resolve(null);
    return ClientModel.findOne({ garageId, $or: validConditions }).exec();
  }

  static async create(clientData: Omit<ClientDocument, "_id">, garageId: string): Promise<ClientDocument> {
    const sanitizedData = removeEmptyFields(clientData);
    const newClient = new ClientModel({ ...sanitizedData, garageId });
    return newClient.save();
  }

  static async update(id: string, clientData: Partial<ClientDocument>, garageId: string): Promise<ClientDocument | null> {
    return ClientModel.findOneAndUpdate({ _id: id, garageId }, clientData, { new: true }).exec();
  }

  static async delete(id: string, garageId: string): Promise<boolean> {
    const result = await ClientModel.findOneAndDelete({ _id: id, garageId }).exec();
    if (result) {
      await VehicleModel.deleteMany({ clientId: result._id }).exec();
    }
    return result !== null;
  }

  static async findDuplicateForUpdate(id: string, clientData: Partial<ClientDocument>, garageId: string): Promise<ClientDocument | null> {
    const conditions = [];
    if (clientData.email) {
      conditions.push({ email: clientData.email });
    }
    if (clientData.phone) {
      conditions.push({ phone: clientData.phone });
    }
    if (clientData.cpfCnpj) {
      conditions.push({ cpfCnpj: clientData.cpfCnpj });
    }
    const validConditions = conditions.filter((condition) => Object.values(condition)[0]);
    if (validConditions.length === 0) return null;
    const query = { garageId, _id: { $ne: id }, $or: validConditions };
    return ClientModel.findOne(query).exec();
  }
}
