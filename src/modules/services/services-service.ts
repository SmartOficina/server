import { ServicesModel } from "./services-model";
import { ServiceDocument } from "./services-entity";

class ServicesService {
  static async listServices(search: string, limit: number, page: number, garageId: string, sortOrder: string = "newest", filterPeriod: string = "all", filterPriceRange: string = "all"): Promise<{ services: ServiceDocument[]; totalPages: number; totalItems: number }> {
    return await ServicesModel.find(search, limit, page, garageId, sortOrder, filterPeriod, filterPriceRange);
  }

  static async createService(serviceData: Omit<ServiceDocument, "_id">, garageId: string): Promise<ServiceDocument> {
    const duplicate = await ServicesModel.findDuplicate(serviceData.code, garageId);
    if (duplicate) {
      throw new Error(`Já existe um serviço com o código ${serviceData.code}.`);
    }
    return await ServicesModel.create(serviceData, garageId);
  }

  static async editService(id: string, serviceData: Partial<ServiceDocument>, garageId: string): Promise<ServiceDocument | null> {
    if (serviceData.code) {
      const duplicate = await ServicesModel.findDuplicateForUpdate(id, serviceData.code, garageId);
      if (duplicate) {
        throw new Error(`Já existe um serviço com o código ${serviceData.code}.`);
      }
    }
    return await ServicesModel.update(id, serviceData, garageId);
  }

  static async removeService(id: string, garageId: string): Promise<boolean> {
    return await ServicesModel.delete(id, garageId);
  }
}

export default ServicesService;
