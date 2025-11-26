import { removeEmptyFields } from "../../../core/utils/data-utils";
import { InventoryEntryModel } from "../entries/entries-entity";
import { PartModel, PartDocument } from "./parts-entity";
import mongoose from "mongoose";

export class PartsModel {
  static async find(search: string, limit: number, page: number, garageId: string, filterStockStatus: string = "all", filterCategory: string = "all", sortOrder: string = "name"): Promise<{ parts: PartDocument[]; totalPages: number; totalItems: number }> {
    const totalPartsForGarage = await PartModel.countDocuments({ garageId });

    const query: any = {
      garageId: new mongoose.Types.ObjectId(garageId),
    };

    if (search && search.trim() !== "") {
      query.$or = [{ code: { $regex: search, $options: "i" } }, { name: { $regex: search, $options: "i" } }, { unit: { $regex: search, $options: "i" } }, { barcode: { $regex: search, $options: "i" } }, { manufacturerCode: { $regex: search, $options: "i" } }, { ncmCode: { $regex: search, $options: "i" } }];
    }

    if (filterCategory && filterCategory !== "all") {
      if (filterCategory === "") {
        query.$or = [...(query.$or || []), { category: { $in: ["", null] } }];
      } else {
        query.category = filterCategory;
      }
    }



    if (filterStockStatus !== "all" || sortOrder === "stock_asc" || sortOrder === "stock_desc") {
      const allParts = await PartModel.find(query).exec();

      const allPartsWithStock = await Promise.all(
        allParts.map(async (part: any) => {
          const currentStock = await this.calculateStockQuantity(part._id.toString(), garageId);
          part.set("currentStock", currentStock, { strict: false });
          return part;
        })
      );

      let filteredParts = allPartsWithStock;
      if (filterStockStatus !== "all") {
        filteredParts = allPartsWithStock.filter((part: any) => {
          const stock = part.get("currentStock") || 0;
          const minStock = part.minimumStock || 0;

          switch (filterStockStatus) {
            case "available":
              return stock > 0;
            case "low":
              return stock > 0 && stock < minStock;
            case "out":
              return stock === 0;
            default:
              return true;
          }
        });
      }

      if (sortOrder === "stock_asc" || sortOrder === "stock_desc") {
        filteredParts.sort((a: any, b: any) => {
          const stockA = a.get("currentStock") || 0;
          const stockB = b.get("currentStock") || 0;
          return sortOrder === "stock_asc" ? stockA - stockB : stockB - stockA;
        });
      } else {
        let sortOptions: any = {};
        switch (sortOrder) {
          case "name_desc":
            sortOptions = { name: -1 };
            break;
          case "code":
            sortOptions = { code: 1 };
            break;
          case "price_asc":
            sortOptions = { sellingPrice: 1 };
            break;
          case "price_desc":
            sortOptions = { sellingPrice: -1 };
            break;
          default:
          sortOptions = { name: 1 };
            break;
        }

        if (Object.keys(sortOptions).length > 0) {
          const sortField = Object.keys(sortOptions)[0];
          const sortDirection = sortOptions[sortField];
          filteredParts.sort((a: any, b: any) => {
            const aValue = a[sortField] || "";
            const bValue = b[sortField] || "";
            if (sortDirection === 1) {
              return aValue > bValue ? 1 : -1;
            } else {
              return aValue < bValue ? 1 : -1;
            }
          });
        }
      }

      const totalFilteredItems = filteredParts.length;
      const totalPages = Math.ceil(totalFilteredItems / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedParts = filteredParts.slice(startIndex, endIndex);

      return { parts: paginatedParts, totalPages, totalItems: totalFilteredItems };
    } else {
      const totalItems = await PartModel.countDocuments(query);

      const totalPages = Math.ceil(totalItems / limit);

      let sortOptions: any = {};
      switch (sortOrder) {
        case "name_desc":
          sortOptions = { name: -1 };
          break;
        case "code":
          sortOptions = { code: 1 };
          break;
        case "price_asc":
          sortOptions = { sellingPrice: 1 };
          break;
        case "price_desc":
          sortOptions = { sellingPrice: -1 };
          break;
        default:
          sortOptions = { name: 1 };
          break;
      }

      const parts = await PartModel.find(query)
        .sort(sortOptions)
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

      const partsWithStock = await Promise.all(
        parts.map(async (part: any) => {
          const currentStock = await this.calculateStockQuantity(part._id.toString(), garageId);
          part.set("currentStock", currentStock, { strict: false });
          return part;
        })
      );

      return { parts: partsWithStock, totalPages, totalItems };
    }
  }

  static findByCode(code: string, garageId: string): Promise<PartDocument | null> {
    return PartModel.findOne({ code, garageId }).exec();
  }

  static async findById(id: string, garageId: string): Promise<PartDocument | null> {
    const part = await PartModel.findOne({ _id: id, garageId }).exec();
    if (part) {
      const currentStock = await this.calculateStockQuantity(id, garageId);
      part.set("currentStock", currentStock, { strict: false });
    }
    return part;
  }

  static async create(partData: Omit<PartDocument, "_id">, garageId: string): Promise<PartDocument> {
    const sanitizedData = removeEmptyFields(partData);
    const newPart = new PartModel({
      ...sanitizedData,
      garageId,
      updatedAt: new Date(),
    });

    const part = await newPart.save();

    part.set("currentStock", 0, { strict: false });

    return part;
  }

  static async update(id: string, partData: Partial<PartDocument>, garageId: string): Promise<PartDocument | null> {
    const updatedPart = await PartModel.findOneAndUpdate({ _id: id, garageId }, { ...partData, updatedAt: new Date() }, { new: true }).exec();

    if (updatedPart) {
      const currentStock = await this.calculateStockQuantity(id, garageId);
      updatedPart.set("currentStock", currentStock, { strict: false });
    }

    return updatedPart;
  }

  static async delete(id: string, garageId: string): Promise<boolean> {
    const hasEntries = await InventoryEntryModel.exists({ partId: id });
    if (hasEntries) {
      throw new Error("Não é possível excluir uma peça que possui lançamentos de estoque.");
    }

    const result = await PartModel.findOneAndDelete({ _id: id, garageId }).exec();
    return result !== null;
  }

  static async calculateStockQuantity(partId: string, garageId: string, session?: mongoose.ClientSession): Promise<number> {
    const aggregateOptions: any[] = [
      {
        $match: {
          partId: new mongoose.Types.ObjectId(partId),
          garageId: new mongoose.Types.ObjectId(garageId),
        },
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
        },
      },
    ];

    let result;
    if (session) {
      result = await InventoryEntryModel.aggregate(aggregateOptions).session(session).exec();
    } else {
      result = await InventoryEntryModel.aggregate(aggregateOptions).exec();
    }

    return result.length > 0 ? result[0].totalQuantity : 0;
  }

  static async calculateAverageCost(partId: string, garageId: string): Promise<number> {
    const entries = await InventoryEntryModel.find({
      partId,
      garageId,
      quantity: { $gt: 0 },
    }).exec();

    if (entries.length === 0) return 0;

    let totalCost = 0;
    let totalQuantity = 0;

    entries.forEach((entry) => {
      totalCost += entry.costPrice * entry.quantity;
      totalQuantity += entry.quantity;
    });

    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  }

  static async updateStockInfo(partId: string, garageId: string): Promise<PartDocument | null> {
    const currentStock = await this.calculateStockQuantity(partId, garageId);
    const averageCost = await this.calculateAverageCost(partId, garageId);

    const updatedPart = await PartModel.findOneAndUpdate({ _id: partId, garageId }, { averageCost, updatedAt: new Date() }, { new: true }).exec();

    if (updatedPart) {
      updatedPart.set("currentStock", currentStock, { strict: false });
    }

    return updatedPart;
  }

  static async updateStockInfoInSession(partId: string, garageId: string, session: mongoose.ClientSession): Promise<PartDocument | null> {
    const currentStock = await this.calculateStockQuantity(partId, garageId, session);
    const averageCost = await this.calculateAverageCost(partId, garageId);

    const updatedPart = await PartModel.findOneAndUpdate({ _id: partId, garageId }, { averageCost, updatedAt: new Date() }, { new: true, session }).exec();

    if (updatedPart) {
      updatedPart.set("currentStock", currentStock, { strict: false });
    }

    return updatedPart;
  }
}
