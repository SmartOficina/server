import { ServiceModel, ServiceDocument } from "./services-entity";
import { removeEmptyFields } from "../../core/utils/data-utils";

export class ServicesModel {
  static async find(search: string, limit: number, page: number, garageId: string, sortOrder: string = "newest", filterPeriod: string = "all", filterPriceRange: string = "all"): Promise<{ services: ServiceDocument[]; totalPages: number; totalItems: number }> {
    const limitNum = Math.max(1, Number(limit) || 10);
    const pageNum = Math.max(1, Number(page) || 1);

    const query: any = { garageId };

    if (search) {
      query.$or = [{ code: { $regex: search, $options: "i" } }, { name: { $regex: search, $options: "i" } }];
    }

    if (filterPeriod !== "all") {
      const dateFilter = this.buildDateFilter(filterPeriod);
      if (dateFilter) {
        query.createdAt = dateFilter;
      }
    }

    if (filterPriceRange !== "all") {
      const priceFilter = this.buildPriceFilter(filterPriceRange);
      if (priceFilter) {
        query.sellingPrice = priceFilter;
      }
    }

    const totalServices = await ServiceModel.countDocuments(query);
    const totalPages = Math.ceil(totalServices / limitNum) || 1;

    const sortOptions = this.getSortOptions(sortOrder);

    const services = await ServiceModel.find(query)
      .sort(sortOptions)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .exec();

    return {
      services,
      totalPages,
      totalItems: totalServices,
    };
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

  private static buildPriceFilter(priceRange: string): { $lte?: number; $gte?: number } | null {
    switch (priceRange) {
      case "low":
        return { $lte: 100 };
      case "medium":
        return { $gte: 100, $lte: 300 };
      case "high":
        return { $gte: 300 };
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
      case "name":
        return { name: 1 };
      case "name_desc":
        return { name: -1 };
      case "price_asc":
        return { sellingPrice: 1 };
      case "price_desc":
        return { sellingPrice: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  static findDuplicate(code: string, garageId: string): Promise<ServiceDocument | null> {
    if (!code) return Promise.resolve(null);
    return ServiceModel.findOne({ garageId, code }).exec();
  }

  static async create(serviceData: Omit<ServiceDocument, "_id">, garageId: string): Promise<ServiceDocument> {
    const sanitizedData = removeEmptyFields(serviceData);
    const newService = new ServiceModel({ ...sanitizedData, garageId });
    return newService.save();
  }

  static async update(id: string, serviceData: Partial<ServiceDocument>, garageId: string): Promise<ServiceDocument | null> {
    return ServiceModel.findOneAndUpdate({ _id: id, garageId }, serviceData, { new: true }).exec();
  }

  static async delete(id: string, garageId: string): Promise<boolean> {
    const result = await ServiceModel.findOneAndDelete({ _id: id, garageId }).exec();
    return result !== null;
  }

  static async findDuplicateForUpdate(id: string, code: string, garageId: string): Promise<ServiceDocument | null> {
    if (!code) return null;
    const query = { garageId, _id: { $ne: id }, code };
    return ServiceModel.findOne(query).exec();
  }
}
