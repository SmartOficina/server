import { removeEmptyFields } from "../../../core/utils/data-utils";
import { InventoryEntryModel, InventoryEntryDocument } from "./entries-entity";
import { PartsModel } from "../parts/parts-model";
import mongoose from "mongoose";
import logger from "../../../logger";

export class InventoryEntriesModel {
  static async find(
    search: string,
    limit: number,
    page: number,
    garageId: string,
    movementType?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    entries: any[];
    totalPages: number;
    totalItems: number;
  }> {
    let matchQuery: any = { garageId };

    if (movementType && movementType !== "all") {
      matchQuery.movementType = movementType;
    }

    if (startDate || endDate) {
      matchQuery.entryDate = {};
      if (startDate) matchQuery.entryDate.$gte = startDate;
      if (endDate) matchQuery.entryDate.$lte = endDate;
    }

    if (search && search.trim() !== "" && search !== "undefined" && search !== "null") {
      const searchConditions = [{ invoiceNumber: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }, { reference: { $regex: search, $options: "i" } }];

      matchQuery.$or = searchConditions;
    }

    const totalItems = await InventoryEntryModel.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalItems / limit);

    const entries = await InventoryEntryModel.find(matchQuery)
      .populate("partId")
      .populate("supplierId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    return { entries, totalPages, totalItems };
  }

  static async findByPart(
    partId: string,
    limit: number,
    page: number,
    garageId: string
  ): Promise<{
    entries: InventoryEntryDocument[];
    totalPages: number;
    totalItems: number;
  }> {
    const query = { partId, garageId };

    const totalItems = await InventoryEntryModel.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    const entries = await InventoryEntryModel.find(query)
      .populate("partId")
      .populate("supplierId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    return { entries, totalPages, totalItems };
  }

  static async findBySupplier(
    supplierId: string,
    limit: number,
    page: number,
    garageId: string
  ): Promise<{
    entries: InventoryEntryDocument[];
    totalPages: number;
    totalItems: number;
  }> {
    const query = { supplierId, garageId };

    const totalItems = await InventoryEntryModel.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    const entries = await InventoryEntryModel.find(query)
      .populate("partId")
      .populate("supplierId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    return { entries, totalPages, totalItems };
  }

  static async findById(id: string, garageId: string): Promise<InventoryEntryDocument | null> {
    return InventoryEntryModel.findOne({ _id: id, garageId }).populate("partId").populate("supplierId").exec();
  }

  static async create(entryData: Omit<InventoryEntryDocument, "_id">, garageId: string): Promise<InventoryEntryDocument> {
    const sanitizedData = removeEmptyFields(entryData);

    const currentQuantity = await PartsModel.calculateStockQuantity(sanitizedData.partId.toString(), garageId);

    const newEntry = new InventoryEntryModel({
      ...sanitizedData,
      currentQuantity,
      garageId,
      updatedAt: new Date(),
    });

    const savedEntry = await newEntry.save();

    await PartsModel.updateStockInfo(savedEntry.partId.toString(), garageId);

    return savedEntry;
  }

  static async update(id: string, entryData: Partial<InventoryEntryDocument>, garageId: string): Promise<InventoryEntryDocument | null> {
    const update = {
      ...entryData,
      updatedAt: new Date(),
    };

    const updatedEntry = await InventoryEntryModel.findOneAndUpdate({ _id: id, garageId }, update, { new: true }).populate("partId").populate("supplierId").exec();

    if (updatedEntry) {
      await PartsModel.updateStockInfo(updatedEntry.partId.toString(), garageId);
    }

    return updatedEntry;
  }

  static async delete(id: string, garageId: string): Promise<boolean> {
    const entry = await InventoryEntryModel.findOne({ _id: id, garageId }).exec();

    if (!entry) return false;

    const result = await InventoryEntryModel.findOneAndDelete({ _id: id, garageId }).exec();

    if (result) {
      await PartsModel.updateStockInfo(result.partId.toString(), garageId);
    }

    return result !== null;
  }

  static async createExit(
    exitData: {
      partId: string;
      quantity: number;
      description: string;
      exitType: string;
      reference?: string;
      costPrice?: number;
      sellingPrice?: number;
    },
    garageId: string
  ): Promise<InventoryEntryDocument> {
    if (!exitData.partId || !exitData.quantity || exitData.quantity <= 0) {
      throw new Error("Dados de saída inválidos: partId e quantity são obrigatórios e quantity deve ser maior que zero");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(`Iniciando saída de estoque: peça=${exitData.partId}, quantidade=${exitData.quantity}, tipo=${exitData.exitType}`);

      const part = await PartsModel.findById(exitData.partId, garageId);
      if (!part) {
        throw new Error("Peça não encontrada");
      }

      const stockResult = await InventoryEntryModel.aggregate([
        {
          $match: {
            partId: new mongoose.Types.ObjectId(exitData.partId),
            garageId: new mongoose.Types.ObjectId(garageId),
          },
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
          },
        },
      ]).session(session);

      const currentStock = stockResult.length > 0 ? stockResult[0].totalQuantity : 0;

      logger.info(`Estoque atual da peça ${part.name}: ${currentStock}, solicitado: ${exitData.quantity}`);

      if (currentStock < exitData.quantity) {
        throw new Error(`Estoque insuficiente para a peça "${part.name}". Disponível: ${currentStock}, Solicitado: ${exitData.quantity}`);
      }

      const finalStock = currentStock - exitData.quantity;
      if (finalStock < 0) {
        throw new Error(`Operação resultaria em estoque negativo para a peça "${part.name}". Estoque atual: ${currentStock}, Quantidade solicitada: ${exitData.quantity}`);
      }

      const entryData = {
        partId: exitData.partId,
        quantity: -exitData.quantity,
        costPrice: exitData.costPrice ?? part.averageCost ?? part.costPrice ?? 0,
        sellingPrice: exitData.sellingPrice ?? part.sellingPrice ?? 0,
        description: exitData.description,
        movementType: "exit" as const,
        exitType: exitData.exitType,
        reference: exitData.reference || "",
        garageId,
        entryDate: new Date(),
        currentQuantity: finalStock,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newEntry = new InventoryEntryModel(entryData);
      const savedEntry = await newEntry.save({ session });

      await PartsModel.updateStockInfoInSession(exitData.partId, garageId, session);

      await session.commitTransaction();
      session.endSession();

      logger.info(`Saída de estoque realizada com sucesso: ${exitData.quantity} unidades da peça ${part.name}`);

      return savedEntry;
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();

      logger.error({ error: error.message }, `Erro ao processar saída de estoque: peça=${exitData.partId}, quantidade=${exitData.quantity}`);
      throw error;
    }
  }
}
