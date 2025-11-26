import axios from "axios";
import * as cheerio from "cheerio";
import { VehiclesModel } from "./vehicles-model";
import { VehicleDocument } from "./vehicles-entity";

interface VehicleInfo {
  brandModel: string;
  year: string;
  color: string;
  chassi: string;
}

class VehiclesService {
  static async listVehicles(search: string, limit: number, page: number, garageId: string, sortOrder: string = "newest", filterPeriod: string = "all", inGarage: boolean = false): Promise<{ vehicles: any[]; totalPages: number; totalItems: number }> {

    const limitNum = Math.max(1, Number(limit) || 10);
    const pageNum = Math.max(1, Number(page) || 1);

    return await VehiclesModel.find(search, limitNum, pageNum, garageId, sortOrder, filterPeriod, inGarage);
  }

  static async createVehicle(vehicleData: Partial<VehicleDocument>, garageId: string): Promise<VehicleDocument> {
    if (!vehicleData.clientId || !vehicleData.licensePlate) {
      throw new Error("clientId e licensePlate são obrigatórios.");
    }


    if (vehicleData.licensePlate) {
      vehicleData.licensePlate = vehicleData.licensePlate.trim().toUpperCase();


      const duplicate = await VehiclesModel.findDuplicate(vehicleData.licensePlate, garageId);
      if (duplicate) {
        throw new Error("Placa de veículo já cadastrada na sua oficina.");
      }
    }

    return await VehiclesModel.create(vehicleData, garageId);
  }

  static async editVehicle(id: string, vehicleData: Partial<VehicleDocument>, garageId: string): Promise<VehicleDocument | null> {
    if (!id || !garageId) {
      throw new Error("ID do veículo e ID da oficina são obrigatórios para edição.");
    }


    if (vehicleData.licensePlate) {
      vehicleData.licensePlate = vehicleData.licensePlate.trim().toUpperCase();


      const duplicate = await VehiclesModel.findDuplicateForUpdate(id, vehicleData.licensePlate, garageId);
      if (duplicate) {
        throw new Error("Placa de veículo já cadastrada na sua oficina.");
      }
    }

    return await VehiclesModel.update(id, vehicleData, garageId);
  }

  static async removeVehicle(id: string, garageId: string): Promise<boolean> {
    if (!id || !garageId) {
      throw new Error("ID do veículo e ID da oficina são obrigatórios para remoção.");
    }

    return await VehiclesModel.delete(id, garageId);
  }

  static async getVehicleInfoByPlate(licensePlate: string): Promise<VehicleInfo> {
    if (!licensePlate || licensePlate.trim() === "") {
      throw new Error("Placa do veículo é obrigatória para buscar informações.");
    }

    try {
      const url = `https://placasbrasil.com/placa/${licensePlate}`;
      const { data: html } = await axios.get(url);
      const $ = cheerio.load(html);

      let brandModel = "";
      let year = "";
      let color = "";
      let chassi = "";

      $("div.card-detail").each((i, el) => {
        const label = $(el).find("strong").text().trim();
        const value = $(el).find("span").text().trim();

        if (label.includes("Marca/Modelo")) {
          brandModel = value;
        }
        if (label.includes("Ano:")) {
          year = value.split("/")[0].trim();
        }
        if (label.includes("Cor:")) {
          color = value;
        }
        if (label.includes("Chassi:")) {
          chassi = value;
        }
      });

      return { brandModel, year, color, chassi };
    } catch (error) {

      throw new Error("Não foi possível obter informações do veículo. Tente novamente mais tarde.");
    }
  }
}

export default VehiclesService;
