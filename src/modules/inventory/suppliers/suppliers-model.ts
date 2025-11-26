import { removeEmptyFields } from "../../../core/utils/data-utils";
import { InventoryEntryModel } from "../entries/entries-entity";
import { SupplierModel, SupplierDocument } from "./suppliers-entity";

export class SuppliersModel {
  static async find(search: string, limit: number, page: number, garageId: string, filterPeriod: string = "all", filterState: string = "all", sortOrder: string = "name"): Promise<{ suppliers: SupplierDocument[]; totalPages: number; totalItems: number }> {
    const query: any = {
      garageId,
      $or: [{ code: { $regex: search, $options: "i" } }, { name: { $regex: search, $options: "i" } }, { cnpj: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }, { mobile: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { "address.city": { $regex: search, $options: "i" } }],
    };

    if (filterState !== "all") {
      query["address.state"] = filterState;
    }

    if (filterPeriod !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (filterPeriod) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }

      if (filterPeriod !== "all") {
        query.createdAt = { $gte: startDate };
      }
    }

    const totalItems = await SupplierModel.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    let sortOptions: any = {};
    switch (sortOrder) {
      case "name_desc":
        sortOptions = { name: -1 };
        break;
      case "code":
        sortOptions = { code: 1 };
        break;
      case "cnpj":
        sortOptions = { cnpj: 1 };
        break;
      case "date_asc":
        sortOptions = { createdAt: 1 };
        break;
      case "date_desc":
        sortOptions = { createdAt: -1 };
        break;
      default:
        sortOptions = { name: 1 };
        break;
    }

    const suppliers = await SupplierModel.find(query)
      .sort(sortOptions)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    return { suppliers, totalPages, totalItems };
  }

  static findDuplicate(conditions: { [key: string]: string }[], garageId: string): Promise<SupplierDocument | null> {
    const validConditions = conditions.filter((condition) => {
      const value = Object.values(condition)[0];
      return value !== undefined && value !== null && value !== "";
    });

    if (validConditions.length === 0) return Promise.resolve(null);

    return SupplierModel.findOne({ garageId, $or: validConditions }).exec();
  }

  static findByCode(code: string, garageId: string): Promise<SupplierDocument | null> {
    return SupplierModel.findOne({ code, garageId }).exec();
  }

  static findByCnpj(cnpj: string, garageId: string): Promise<SupplierDocument | null> {
    return SupplierModel.findOne({ cnpj, garageId }).exec();
  }

  static findById(id: string, garageId: string): Promise<SupplierDocument | null> {
    return SupplierModel.findOne({ _id: id, garageId }).exec();
  }

  static async create(supplierData: Omit<SupplierDocument, "_id">, garageId: string): Promise<SupplierDocument> {
    const sanitizedData = removeEmptyFields(supplierData);
    const newSupplier = new SupplierModel({
      ...sanitizedData,
      garageId,
      updatedAt: new Date(),
    });
    return newSupplier.save();
  }

  static async update(id: string, supplierData: Partial<SupplierDocument>, garageId: string): Promise<SupplierDocument | null> {
    return SupplierModel.findOneAndUpdate({ _id: id, garageId }, { ...supplierData, updatedAt: new Date() }, { new: true }).exec();
  }

  static async delete(id: string, garageId: string): Promise<boolean> {
    const hasEntries = await InventoryEntryModel.exists({ supplierId: id });
    if (hasEntries) {
      throw new Error("Não é possível excluir um fornecedor que possui lançamentos de estoque.");
    }

    const result = await SupplierModel.findOneAndDelete({ _id: id, garageId }).exec();
    return result !== null;
  }

  static async findDuplicateForUpdate(id: string, supplierData: Partial<SupplierDocument>, garageId: string): Promise<SupplierDocument | null> {
    const conditions = [];

    if (supplierData.code) {
      conditions.push({ code: supplierData.code });
    }

    if (supplierData.cnpj) {
      conditions.push({ cnpj: supplierData.cnpj });
    }

    const validConditions = conditions.filter((condition) => Object.values(condition)[0]);

    if (validConditions.length === 0) return null;

    const query = { garageId, _id: { $ne: id }, $or: validConditions };
    return SupplierModel.findOne(query).exec();
  }
}
