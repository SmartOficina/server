import { PartsModel } from "./parts-model";
import { PartDocument } from "./parts-entity";

class PartsService {
  static async listParts(
    search: string,
    limit: number,
    page: number,
    garageId: string,
    filterStockStatus: string = "all",
    filterCategory: string = "all",
    sortOrder: string = "name"
  ): Promise<{
    parts: PartDocument[];
    totalPages: number;
    totalItems: number;
  }> {
    return await PartsModel.find(search, limit, page, garageId, filterStockStatus, filterCategory, sortOrder);
  }

  static async getPartById(id: string, garageId: string): Promise<PartDocument | null> {
    return await PartsModel.findById(id, garageId);
  }

  static async getPartStock(id: string, garageId: string): Promise<number> {
    return await PartsModel.calculateStockQuantity(id, garageId);
  }

  static async createPart(partData: Omit<PartDocument, "_id">, garageId: string): Promise<PartDocument> {
    const existingPart = await PartsModel.findByCode(partData.code, garageId);
    if (existingPart) {
      throw new Error("Código já cadastrado na sua oficina.");
    }

    if (!partData.sellingPrice && partData.costPrice && partData.profitMargin) {
      partData.sellingPrice = partData.costPrice * (1 + partData.profitMargin / 100);
    }

    return await PartsModel.create(partData, garageId);
  }

  static async editPart(id: string, partData: Partial<PartDocument>, garageId: string): Promise<PartDocument | null> {
    if (partData.code) {
      const existingPart: any = await PartsModel.findByCode(partData.code, garageId);
      if (existingPart && existingPart._id.toString() !== id) {
        throw new Error("Código já cadastrado na sua oficina.");
      }
    }

    if (partData.costPrice && partData.profitMargin && !partData.sellingPrice) {
      partData.sellingPrice = partData.costPrice * (1 + partData.profitMargin / 100);
    }

    return await PartsModel.update(id, partData, garageId);
  }

  static async removePart(id: string, garageId: string): Promise<boolean> {
    try {
      return await PartsModel.delete(id, garageId);
    } catch (error: any) {
      throw new Error(error.message || "Falha ao remover peça.");
    }
  }

  static async calculateSellingPrice(costPrice: number, profitMargin: number): Promise<number> {
    return costPrice * (1 + profitMargin / 100);
  }

  static async checkPartsAvailability(
    parts: { partId: string; quantity: number }[],
    garageId: string
  ): Promise<{
    allAvailable: boolean;
    items: any[];
  }> {
    const availability = await Promise.all(
      parts.map(async (partRequest) => {
        const { partId, quantity } = partRequest;
        const part = await PartsModel.findById(partId, garageId);

        if (!part) {
          return {
            partId,
            available: false,
            requiredQuantity: quantity,
            availableQuantity: 0,
            partName: "Peça não encontrada",
          };
        }

        const stock = await PartsModel.calculateStockQuantity(partId, garageId);

        return {
          partId,
          available: stock >= quantity,
          requiredQuantity: quantity,
          availableQuantity: stock,
          partName: part.name,
        };
      })
    );

    const allAvailable = availability.every((item) => item.available);

    return {
      allAvailable,
      items: availability,
    };
  }
}

export default PartsService;
