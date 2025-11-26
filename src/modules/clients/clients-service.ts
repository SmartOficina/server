import { ClientsModel } from "./clients-model";
import { ClientDocument, ClientModel } from "./clients-entity";
import { buildDuplicateConditions } from "../../core/utils/duplicate-checker";

class ClientsService {
  static async listClients(search: string, limit: number, page: number, garageId: string, sortOrder: string = "newest", filterPeriod: string = "all", filterVehicleStatus: string = "all"): Promise<{ clients: ClientDocument[]; totalPages: number; totalItems: number }> {
    const limitNum = Math.max(1, Number(limit) || 10);
    const pageNum = Math.max(1, Number(page) || 1);

    return await ClientsModel.find(search, limitNum, pageNum, garageId, sortOrder, filterPeriod, filterVehicleStatus);
  }

  static async createClient(clientData: Omit<ClientDocument, "_id">, garageId: string): Promise<ClientDocument> {
    const conditions = buildDuplicateConditions(clientData, ["email", "phone", "cpfCnpj"]);
    if (conditions.length > 0) {
      const duplicate = await ClientsModel.findDuplicate(conditions, garageId);
      if (duplicate) {
        let duplicateField = "";
        if (clientData.email && duplicate.email === clientData.email) {
          duplicateField = "Email";
        } else if (clientData.phone && duplicate.phone === clientData.phone) {
          duplicateField = "Telefone";
        } else if (clientData.cpfCnpj && duplicate.cpfCnpj === clientData.cpfCnpj) {
          duplicateField = "CPF/CNPJ";
        }
        throw new Error(`${duplicateField} já cadastrado na sua oficina.`);
      }
    }
    return await ClientsModel.create(clientData, garageId);
  }

  static async editClient(id: string, clientData: Partial<ClientDocument>, garageId: string): Promise<ClientDocument | null> {
    if (clientData.email || clientData.phone || clientData.cpfCnpj) {
      const duplicate = await ClientsModel.findDuplicateForUpdate(id, clientData, garageId);
      if (duplicate) {
        let duplicateField = "";
        if (clientData.email && duplicate.email === clientData.email) {
          duplicateField = "Email";
        } else if (clientData.phone && duplicate.phone === clientData.phone) {
          duplicateField = "Celular";
        } else if (clientData.cpfCnpj && duplicate.cpfCnpj === clientData.cpfCnpj) {
          duplicateField = "CPF/CNPJ";
        }
        throw new Error(`${duplicateField} já cadastrado na sua oficina.`);
      }
    }
    return await ClientsModel.update(id, clientData, garageId);
  }

  static async removeClient(id: string, garageId: string): Promise<boolean> {
    if (!id || !garageId) {
      throw new Error("ID do cliente e ID da oficina são obrigatórios para remoção.");
    }
    return await ClientsModel.delete(id, garageId);
  }

  static async updateClientPhoto(id: string, photoBase64: string, garageId: string): Promise<ClientDocument | null> {
    if (!id || !photoBase64 || !garageId) {
      throw new Error("Dados insuficientes para atualizar a foto do cliente.");
    }

    const client = await ClientModel.findOne({ _id: id, garageId }).exec();
    if (!client) {
      throw new Error("Cliente não encontrado.");
    }

    return await ClientsModel.update(id, { photo: photoBase64 }, garageId);
  }

  static async removeClientPhoto(id: string, garageId: string): Promise<ClientDocument | null> {
    if (!id || !garageId) {
      throw new Error("Dados insuficientes para remover a foto do cliente.");
    }

    const client = await ClientModel.findOne({ _id: id, garageId }).exec();
    if (!client) {
      throw new Error("Cliente não encontrado.");
    }

    return await ClientModel.findOneAndUpdate({ _id: id, garageId }, { $unset: { photo: "" } }, { new: true }).exec();
  }
}

export default ClientsService;
