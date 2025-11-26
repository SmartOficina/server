import { ScheduleModel } from "./schedule-model";
import { ScheduleEventDocument, EventStatus } from "./schedule-entity";
import { VehicleModel } from "../vehicles/vehicles-entity";
import { ClientModel } from "../clients/clients-entity";

class ScheduleService {
  static async listEvents(startDate: string, endDate: string, garageId: string): Promise<{ events: any[]; totalItems: number }> {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new Error("Datas de início e fim inválidas.");
    }

    return await ScheduleModel.find(startDateObj, endDateObj, garageId);
  }

  static async createEvent(eventData: Partial<ScheduleEventDocument>, garageId: string): Promise<ScheduleEventDocument> {
    this.validateEventData(eventData);

    if (eventData.date && eventData.time) {
      let dateStr: string;
      const dateInput: any = eventData.date;

      if (dateInput instanceof Date) {
        dateStr = dateInput.toISOString().split("T")[0];
      } else if (typeof dateInput === "string") {
        dateStr = dateInput.split("T")[0];
      } else {
        dateStr = new Date(dateInput).toISOString().split("T")[0];
      }

      const [hours, minutes] = eventData.time.split(":").map(Number);
      const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
      const isoDateTimeStr = `${dateStr}T${timeStr}.000Z`;

      eventData.date = new Date(isoDateTimeStr);
    }

    if (eventData.clientId) {
      const clientExists = await ClientModel.findOne({ _id: eventData.clientId, garageId }).exec();
      if (!clientExists) {
        throw new Error("Cliente não encontrado na sua oficina.");
      }
    }

    if (eventData.vehicleId) {
      const vehicleExists = await VehicleModel.findOne({ _id: eventData.vehicleId, garageId }).exec();
      if (!vehicleExists) {
        throw new Error("Veículo não encontrado na sua oficina.");
      }

      if (eventData.clientId && vehicleExists.clientId.toString() !== eventData.clientId) {
        throw new Error("O veículo não pertence ao cliente selecionado.");
      }

      if (!eventData.clientId) {
        eventData.clientId = vehicleExists.clientId;
      }
    }

    return await ScheduleModel.create(eventData, garageId);
  }

  static async updateEvent(id: string, eventData: Partial<ScheduleEventDocument>, garageId: string): Promise<ScheduleEventDocument | null> {
    this.validateEventData(eventData);

    if (eventData.date && eventData.time) {
      let dateStr: string;

      const dateInput: any = eventData.date;

      if (dateInput instanceof Date) {
        dateStr = dateInput.toISOString().split("T")[0];
      } else if (typeof dateInput === "string") {
        dateStr = dateInput.split("T")[0];
      } else {
        dateStr = new Date(dateInput).toISOString().split("T")[0];
      }
      const [hours, minutes] = eventData.time.split(":").map(Number);
      const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
      const isoDateTimeStr = `${dateStr}T${timeStr}.000Z`;
      eventData.date = new Date(isoDateTimeStr);
    }

    if (eventData.clientId) {
      const clientExists = await ClientModel.findOne({ _id: eventData.clientId, garageId }).exec();
      if (!clientExists) {
        throw new Error("Cliente não encontrado na sua oficina.");
      }
    }

    if (eventData.vehicleId) {
      const vehicleExists = await VehicleModel.findOne({ _id: eventData.vehicleId, garageId }).exec();
      if (!vehicleExists) {
        throw new Error("Veículo não encontrado na sua oficina.");
      }

      if (eventData.clientId && vehicleExists.clientId.toString() !== eventData.clientId) {
        throw new Error("O veículo não pertence ao cliente selecionado.");
      }

      if (!eventData.clientId) {
        eventData.clientId = vehicleExists.clientId;
      }
    }

    return await ScheduleModel.update(id, eventData, garageId);
  }

  static async removeEvent(id: string, garageId: string): Promise<boolean> {
    return await ScheduleModel.delete(id, garageId);
  }

  static async updateEventStatus(id: string, status: string, garageId: string): Promise<any> {
    if (!Object.values(EventStatus).includes(status as EventStatus)) {
      throw new Error("Status inválido.");
    }

    return await ScheduleModel.updateStatus(id, status, garageId);
  }

  private static validateEventData(eventData: Partial<ScheduleEventDocument>): void {
    if (!eventData.title) {
      throw new Error("O título do agendamento é obrigatório.");
    }

    if (!eventData.date) {
      throw new Error("A data do agendamento é obrigatória.");
    }

    if (!eventData.time) {
      throw new Error("A hora do agendamento é obrigatória.");
    }

    if (!eventData.serviceTag) {
      throw new Error("A etiqueta de serviço é obrigatória.");
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(eventData.time)) {
      throw new Error("Formato de hora inválido. Use o formato HH:MM.");
    }

    if (eventData.duration !== undefined) {
      const duration = typeof eventData.duration === "string" ? parseInt(eventData.duration, 10) : eventData.duration;

      if (isNaN(duration) || duration <= 0 || duration > 480) {
        throw new Error("A duração deve ser um número inteiro positivo e não maior que 480 minutos (8 horas).");
      }

      eventData.duration = duration;
    }
  }
}

export default ScheduleService;
