import { PartsModel } from "../parts/parts-model";
import { SuppliersModel } from "../suppliers/suppliers-model";
import { InventoryEntryDocument } from "./entries-entity";
import { InventoryEntriesModel } from "./entries-model";
import logger from "../../../logger";

class InventoryEntriesService {
  static async listEntries(
    search: string,
    limit: number,
    page: number,
    garageId: string,
    movementType?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    entries: InventoryEntryDocument[];
    totalPages: number;
    totalItems: number;
  }> {
    const startDateObj = startDate ? new Date(startDate) : undefined;
    const endDateObj = endDate ? new Date(endDate) : undefined;

    return await InventoryEntriesModel.find(search, limit, page, garageId, movementType, startDateObj, endDateObj);
  }

  static async listEntriesByPart(
    partId: string,
    limit: number,
    page: number,
    garageId: string
  ): Promise<{
    entries: InventoryEntryDocument[];
    totalPages: number;
    totalItems: number;
  }> {
    return await InventoryEntriesModel.findByPart(partId, limit, page, garageId);
  }

  static async listEntriesBySupplier(
    supplierId: string,
    limit: number,
    page: number,
    garageId: string
  ): Promise<{
    entries: InventoryEntryDocument[];
    totalPages: number;
    totalItems: number;
  }> {
    return await InventoryEntriesModel.findBySupplier(supplierId, limit, page, garageId);
  }

  static async createEntry(entryData: Omit<InventoryEntryDocument, "_id">, garageId: string): Promise<InventoryEntryDocument> {
    if (!entryData.partId) {
      throw new Error("ID da peça é obrigatório.");
    }

    if (!entryData.quantity || entryData.quantity <= 0) {
      throw new Error("Quantidade deve ser maior que zero.");
    }

    if (entryData.costPrice < 0) {
      throw new Error("Preço de custo não pode ser negativo.");
    }

    if (entryData.sellingPrice < 0) {
      throw new Error("Preço de venda não pode ser negativo.");
    }

    const part: any = await PartsModel.findById(entryData.partId.toString(), garageId);
    if (!part) {
      throw new Error("Peça não encontrada.");
    }

    if (entryData.supplierId) {
      const supplier = await SuppliersModel.findById(entryData.supplierId.toString(), garageId);
      if (!supplier) {
        throw new Error("Fornecedor não encontrado.");
      }
    }

    if (!entryData.sellingPrice && entryData.costPrice && entryData.profitMargin) {
      entryData.sellingPrice = this.calculateSellingPrice(entryData.costPrice, entryData.profitMargin);
    }

    logger.info(`Criando entrada de estoque: peça=${part.name}, quantidade=${entryData.quantity}, preço=${entryData.costPrice}`);

    const entry = await InventoryEntriesModel.create(entryData, garageId);

    if (entry.sellingPrice !== part.sellingPrice || entry.costPrice !== part.costPrice || entry.profitMargin !== part.profitMargin) {
      await PartsModel.update(
        part._id.toString(),
        {
          sellingPrice: entry.sellingPrice,
          costPrice: entry.costPrice,
          profitMargin: entry.profitMargin,
        },
        garageId
      );
    }

    await PartsModel.updateStockInfo(part._id.toString(), garageId);

    logger.info(`Entrada de estoque criada com sucesso: ${entry._id}, peça=${part.name}, novo estoque será recalculado`);

    return entry;
  }

  static async editEntry(id: string, entryData: Partial<InventoryEntryDocument>, garageId: string): Promise<InventoryEntryDocument | null> {
    if (entryData.quantity !== undefined && entryData.quantity <= 0) {
      throw new Error("Quantidade deve ser maior que zero.");
    }

    if (entryData.costPrice !== undefined && entryData.costPrice < 0) {
      throw new Error("Preço de custo não pode ser negativo.");
    }

    if (entryData.sellingPrice !== undefined && entryData.sellingPrice < 0) {
      throw new Error("Preço de venda não pode ser negativo.");
    }

    if (entryData.costPrice && entryData.profitMargin && !entryData.sellingPrice) {
      entryData.sellingPrice = this.calculateSellingPrice(entryData.costPrice, entryData.profitMargin);
    }

    const currentEntry = await InventoryEntriesModel.findById(id, garageId);
    if (!currentEntry) {
      throw new Error("Lançamento de estoque não encontrado.");
    }

    logger.info(`Editando entrada de estoque: ${id}, mudanças=${JSON.stringify(entryData)}`);

    const updatedEntry = await InventoryEntriesModel.update(id, entryData, garageId);

    if (updatedEntry) {
      await PartsModel.updateStockInfo(updatedEntry.partId.toString(), garageId);
      logger.info(`Entrada de estoque editada com sucesso: ${id}`);
    }

    return updatedEntry;
  }

  static async removeEntry(id: string, garageId: string): Promise<boolean> {
    const currentEntry = await InventoryEntriesModel.findById(id, garageId);
    if (!currentEntry) {
      return false;
    }

    const partId = typeof currentEntry.partId === "object" && currentEntry.partId._id ? currentEntry.partId._id.toString() : currentEntry.partId.toString();

    logger.info(`Removendo entrada de estoque: ${id}, peça=${partId}`);

    const result = await InventoryEntriesModel.delete(id, garageId);

    if (result) {
      await PartsModel.updateStockInfo(partId, garageId);
      logger.info(`Entrada de estoque removida com sucesso: ${id}`);
    }

    return result;
  }

  static async createManualExit(
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
    return await InventoryEntriesModel.createExit(exitData, garageId);
  }

  static calculateSellingPrice(costPrice: number, profitMargin: number): number {
    return costPrice * (1 + profitMargin / 100);
  }
}

export default InventoryEntriesService;
