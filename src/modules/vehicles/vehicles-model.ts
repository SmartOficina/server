import { VehicleModel, VehicleDocument } from "./vehicles-entity";
import { removeEmptyFields } from "../../core/utils/data-utils";
import mongoose from "mongoose";
import { ServiceOrderModel, ServiceOrderStatus } from "../service-orders/service-orders-entity";

export class VehiclesModel {
  static async find(search: string, limit: number, page: number, garageId: string, sortOrder: string = "newest", filterPeriod: string = "all", inGarage: boolean = false): Promise<{ vehicles: any[]; totalPages: number; totalItems: number }> {
    const limitNum = Math.max(1, Number(limit) || 10);
    const pageNum = Math.max(1, Number(page) || 1);

    const query: any = {
      garageId,
    };

    if (search && search.trim() !== "") {
      query.$or = [{ licensePlate: { $regex: search, $options: "i" } }, { brandModel: { $regex: search, $options: "i" } }, { color: { $regex: search, $options: "i" } }, { chassisNumber: { $regex: search, $options: "i" } }];
    }

    if (filterPeriod !== "all") {
      const dateFilter = this.buildDateFilter(filterPeriod);
      if (dateFilter) {
        query.createdAt = dateFilter;
      }
    }

    const sortOptions = this.getSortOptions(sortOrder);
    let vehicles;

    if (inGarage) {
      const activeServiceOrders = await ServiceOrderModel.find({
        garageId,
        status: {
          $nin: [ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELED],
        },
      })
        .select("vehicleId")
        .lean();

      const vehicleIdsInGarage = activeServiceOrders.map((order) => order.vehicleId);
      query._id = { $in: vehicleIdsInGarage };
    }

    const totalVehicles = await VehicleModel.countDocuments(query);
    const totalPages = Math.ceil(totalVehicles / limitNum) || 1;

    if (sortOrder === "lastVisit") {
      vehicles = await VehicleModel.find(query)
        .populate("clientId")
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .exec();

      let vehiclesWithClient = vehicles.map((vehicle) => {
        const obj: any = vehicle.toObject();
        obj.client = obj.clientId;
        delete obj.clientId;
        return obj;
      });

      const vehicleIds = vehiclesWithClient.map((v) => v._id);
      const lastVisits = await this.getLastVisitDates(vehicleIds, garageId);

      vehiclesWithClient = vehiclesWithClient.map((vehicle) => {
        const lastVisit = lastVisits.find((visit) => visit.vehicleId.toString() === vehicle._id.toString());
        vehicle.lastVisitDate = lastVisit ? lastVisit.lastVisitDate : null;
        return vehicle;
      });

      vehiclesWithClient.sort((a, b) => {
        if (!a.lastVisitDate) return 1;
        if (!b.lastVisitDate) return -1;
        return new Date(a.lastVisitDate).getTime() - new Date(b.lastVisitDate).getTime();
      });

      return { vehicles: vehiclesWithClient, totalPages, totalItems: totalVehicles };
    } else {
      vehicles = await VehicleModel.find(query)
        .populate("clientId")
        .sort(sortOptions)
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .exec();

      const vehiclesWithClient = vehicles.map((vehicle) => {
        const obj: any = vehicle.toObject();
        obj.client = obj.clientId;
        delete obj.clientId;
        return obj;
      });

      return { vehicles: vehiclesWithClient, totalPages, totalItems: totalVehicles };
    }
  }

  private static async getLastVisitDates(vehicleIds: any[], garageId: string): Promise<any[]> {
    return await ServiceOrderModel.aggregate([
      {
        $match: {
          garageId: new mongoose.Types.ObjectId(garageId),
          vehicleId: { $in: vehicleIds.map((id) => new mongoose.Types.ObjectId(id)) },
        },
      },
      {
        $sort: { openingDate: -1 },
      },
      {
        $group: {
          _id: "$vehicleId",
          lastVisitDate: { $first: "$openingDate" },
          vehicleId: { $first: "$vehicleId" },
        },
      },
    ]);
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
      case "plate":
        return { licensePlate: 1 };
      case "plate_desc":
        return { licensePlate: -1 };
      case "lastVisit":
        return { createdAt: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  static async create(vehicleData: Partial<VehicleDocument>, garageId: string): Promise<VehicleDocument> {
    const sanitizedData = removeEmptyFields(vehicleData);
    const newVehicle = new VehicleModel({ ...sanitizedData, garageId });
    return newVehicle.save();
  }

  static async update(id: string, vehicleData: Partial<VehicleDocument>, garageId: string): Promise<VehicleDocument | null> {
    return VehicleModel.findOneAndUpdate({ _id: id, garageId }, vehicleData, { new: true }).exec();
  }

  static async delete(id: string, garageId: string): Promise<boolean> {
    const result = await VehicleModel.findOneAndDelete({ _id: id, garageId }).exec();
    return result !== null;
  }

  static async findDuplicate(licensePlate: string, garageId: string): Promise<VehicleDocument | null> {
    if (!licensePlate) return null;
    return VehicleModel.findOne({ licensePlate, garageId }).exec();
  }

  static async findDuplicateForUpdate(id: string, licensePlate: string, garageId: string): Promise<VehicleDocument | null> {
    if (!licensePlate) return null;
    return VehicleModel.findOne({
      licensePlate,
      garageId,
      _id: { $ne: id },
    }).exec();
  }
}
