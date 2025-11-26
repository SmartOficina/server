import { SuppliersModel } from "./suppliers-model";
import { SupplierDocument } from "./suppliers-entity";
class SuppliersService {
  static async listSuppliers(
    search: string,
    limit: number,
    page: number,
    garageId: string,
    filterPeriod: string = "all",
    filterState: string = "all",
    sortOrder: string = "name"
  ): Promise<{
    suppliers: SupplierDocument[];
    totalPages: number;
    totalItems: number;
  }> {
    return await SuppliersModel.find(search, limit, page, garageId, filterPeriod, filterState, sortOrder);
  }

  static async getSupplierById(id: string, garageId: string): Promise<SupplierDocument | null> {
    return await SuppliersModel.findById(id, garageId);
  }

  static async createSupplier(supplierData: Omit<SupplierDocument, "_id">, garageId: string): Promise<SupplierDocument> {
    const existingByCode = await SuppliersModel.findByCode(supplierData.code, garageId);
    if (existingByCode) {
      throw new Error("Código já cadastrado na sua oficina.");
    }

    const existingByCnpj = await SuppliersModel.findByCnpj(supplierData.cnpj, garageId);
    if (existingByCnpj) {
      throw new Error("CNPJ já cadastrado na sua oficina.");
    }

    return await SuppliersModel.create(supplierData, garageId);
  }

  static async editSupplier(id: string, supplierData: Partial<SupplierDocument>, garageId: string): Promise<SupplierDocument | null> {
    if (supplierData.code || supplierData.cnpj) {
      const duplicate = await SuppliersModel.findDuplicateForUpdate(id, supplierData, garageId);
      if (duplicate) {
        let duplicateField = "";
        if (supplierData.code && duplicate.code === supplierData.code) {
          duplicateField = "Código";
        } else if (supplierData.cnpj && duplicate.cnpj === supplierData.cnpj) {
          duplicateField = "CNPJ";
        }
        throw new Error(`${duplicateField} já cadastrado na sua oficina.`);
      }
    }

    return await SuppliersModel.update(id, supplierData, garageId);
  }

  static async removeSupplier(id: string, garageId: string): Promise<boolean> {
    try {
      return await SuppliersModel.delete(id, garageId);
    } catch (error: any) {
      throw new Error(error.message || "Falha ao remover fornecedor.");
    }
  }
}

export default SuppliersService;
