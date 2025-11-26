import { ServiceOrdersModel } from "../service-orders/service-orders-model";
import logger from "../../logger";
import { PartsModel } from "./parts/parts-model";
import { InventoryEntryModel } from "./entries/entries-entity";
import mongoose from "mongoose";

export class InventoryService {
  static async consumePartsFromServiceOrder(serviceOrderId: string, garageId: string): Promise<void> {
    try {
      const serviceOrder = await ServiceOrdersModel.findById(serviceOrderId, garageId);
      if (!serviceOrder) {
        throw new Error(`Ordem de serviço ${serviceOrderId} não encontrada`);
      }

      logger.info(`Peças na OS ${serviceOrderId}: ${JSON.stringify(serviceOrder.requiredParts || [])}`);

      const inventoryParts = (serviceOrder.requiredParts || [])
        .filter((part: any) => {
          logger.info(`Analisando peça: ${part.description}, fromInventory: ${part.fromInventory}, partId: ${part.partId}`);
          return part.fromInventory === true && part.partId;
        })
        .map((part: any) => ({
          partId: part.partId,
          quantity: part.quantity,
          description: part.description,
        }));

      logger.info(`Peças a consumir do estoque na OS ${serviceOrderId}: ${JSON.stringify(inventoryParts)}`);

      if (inventoryParts.length === 0) {
        logger.info(`Nenhuma peça do estoque para consumir na OS ${serviceOrderId}. Verifique se as peças têm os campos 'fromInventory' e 'partId'.`);
        return;
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const availabilityResults = await Promise.all(
          inventoryParts.map(async (partRequest: any) => {
            const { partId, quantity } = partRequest;
            const stock = await PartsModel.calculateStockQuantity(partId, garageId);
            const part = await PartsModel.findById(partId, garageId);

            logger.info(`Verificando disponibilidade de ${part?.name || partId}: disponível=${stock}, necessário=${quantity}`);

            return {
              partId,
              available: stock >= quantity,
              requiredQuantity: quantity,
              availableQuantity: stock,
              partName: part?.name,
            };
          })
        );

        const unavailableItems = availabilityResults.filter((item) => !item.available);

        if (unavailableItems.length > 0) {
          const errorMessage = `Quantidade em estoque insuficiente para as peças: ${unavailableItems.map((item) => item.partName).join(", ")}`;
          logger.error(errorMessage);
          throw new Error(errorMessage);
        }

        await Promise.all(
          inventoryParts.map(async (partRequest: any) => {
            const { partId, quantity } = partRequest;
            const part = await PartsModel.findById(partId, garageId);

            if (!part) {
              throw new Error(`Peça ${partId} não encontrada`);
            }

            const exitEntry = new InventoryEntryModel({
              partId,
              quantity: -quantity,
              costPrice: part.costPrice || 0,
              profitMargin: part.profitMargin || 0,
              sellingPrice: part.sellingPrice || 0,
              description: `Consumo para Ordem de Serviço ${serviceOrderId}`,
              movementType: "exit",
              exitType: "service_order",
              reference: serviceOrderId,
              garageId,
              entryDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            await exitEntry.save({ session });

            await PartsModel.updateStockInfo(partId, garageId);

            logger.info(`Consumido ${quantity} unidades da peça ${part.name} (${partId}) para OS ${serviceOrderId}`);
          })
        );

        await session.commitTransaction();
        session.endSession();

        logger.info(`Peças consumidas com sucesso para OS ${serviceOrderId}`);
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error: any) {
      logger.error({ error: error.message }, `InventoryService::consumePartsFromServiceOrder(${serviceOrderId})`);
      throw error;
    }
  }

  static async restorePartsToServiceOrder(serviceOrderId: string, garageId: string): Promise<void> {
    try {
      const serviceOrder = await ServiceOrdersModel.findById(serviceOrderId, garageId);
      if (!serviceOrder) {
        throw new Error(`Ordem de serviço ${serviceOrderId} não encontrada`);
      }

      logger.info(`Peças na OS ${serviceOrderId}: ${JSON.stringify(serviceOrder.requiredParts || [])}`);

      const inventoryParts = (serviceOrder.requiredParts || [])
        .filter((part: any) => {
          logger.info(`Analisando peça: ${part.description}, fromInventory: ${part.fromInventory}, partId: ${part.partId}`);
          return part.fromInventory === true && part.partId;
        })
        .map((part: any) => ({
          partId: part.partId,
          quantity: part.quantity,
          description: part.description,
        }));

      logger.info(`Peças a restaurar ao estoque na OS ${serviceOrderId}: ${JSON.stringify(inventoryParts)}`);

      if (inventoryParts.length === 0) {
        logger.info(`Nenhuma peça do estoque para restaurar na OS ${serviceOrderId}. Verifique se as peças têm os campos 'fromInventory' e 'partId'.`);
        return;
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await Promise.all(
          inventoryParts.map(async (partRequest: any) => {
            const { partId, quantity } = partRequest;
            const part = await PartsModel.findById(partId, garageId);

            if (!part) {
              throw new Error(`Peça ${partId} não encontrada`);
            }

            const entryData = {
              partId,
              quantity: quantity,
              costPrice: part.costPrice || 0,
              profitMargin: part.profitMargin || 0,
              sellingPrice: part.sellingPrice || 0,
              description: `Restauração de estoque da Ordem de Serviço ${serviceOrderId}`,
              movementType: "entry",
              reference: serviceOrderId,
              garageId,
              entryDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const entry = new InventoryEntryModel(entryData);
            await entry.save({ session });

            await PartsModel.updateStockInfo(partId, garageId);

            logger.info(`Restaurado ${quantity} unidades da peça ${part.name} (${partId}) da OS ${serviceOrderId}`);
          })
        );

        await session.commitTransaction();
        session.endSession();

        logger.info(`Peças restauradas ao estoque com sucesso para OS ${serviceOrderId}`);
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error: any) {
      logger.error({ error: error.message }, `InventoryService::restorePartsToServiceOrder(${serviceOrderId})`);
      throw error;
    }
  }
}
