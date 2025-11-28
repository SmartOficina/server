import mongoose from 'mongoose';
import { ServiceOrderModel, ServiceOrderStatus, PaymentMethod } from '../service-orders/service-orders-entity';
import { PartModel } from '../inventory/parts/parts-entity';
import { InventoryEntryModel } from '../inventory/entries/entries-entity';
import { ScheduleEventModel, EventStatus } from '../schedule/schedule-entity';
import { ClientModel } from '../clients/clients-entity';
import { GarageModel } from '../garage/garage-model';
import { 
  OverviewData, 
  ServiceOrdersStats, 
  FinancialStats, 
  OperationalStats, 
  InventoryStats, 
  ScheduleEvent,
  Alert,
  PeriodFilter 
} from './statistics-model';

export class StatisticsService {

  private getPeriodDates(period: string): PeriodFilter {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  private getPreviousPeriodDates(period: string): PeriodFilter {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();

    switch (period) {
      case 'today':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 14);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 7);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 2);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(now.getMonth() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(now.getMonth() - 3);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate.setMonth(now.getMonth() - 2);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(now.getMonth() - 1);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  async getOverview(garageId: string): Promise<OverviewData> {
    return await this.calculateOverview(garageId);
  }

  private async calculateOverview(garageId: string): Promise<OverviewData> {
    const garageObjectId = new mongoose.Types.ObjectId(garageId);
    const { startDate, endDate } = this.getPeriodDates('month');
    const { startDate: prevStartDate, endDate: prevEndDate } = this.getPreviousPeriodDates('month');

    const currentStats = await ServiceOrderModel.aggregate([
      { $match: { 
        garageId: garageObjectId,
        createdAt: { $gte: startDate, $lte: endDate }
      }},
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [
            { $eq: ['$status', ServiceOrderStatus.COMPLETED] },
            '$finalTotal',
            0
          ]}},
          completedOrders: { $sum: { $cond: [
            { $eq: ['$status', ServiceOrderStatus.COMPLETED] },
            1,
            0
          ]}}
        }
      }
    ]);

    const previousStats = await ServiceOrderModel.aggregate([
      { $match: { 
        garageId: garageObjectId,
        createdAt: { $gte: prevStartDate, $lte: prevEndDate }
      }},
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [
            { $eq: ['$status', ServiceOrderStatus.COMPLETED] },
            '$finalTotal',
            0
          ]}},
          completedOrders: { $sum: { $cond: [
            { $eq: ['$status', ServiceOrderStatus.COMPLETED] },
            1,
            0
          ]}}
        }
      }
    ]);

    const activeClients = await ServiceOrderModel.distinct('vehicleId', {
      garageId: garageObjectId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const prevActiveClients = await ServiceOrderModel.distinct('vehicleId', {
      garageId: garageObjectId,
      createdAt: { 
        $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    });

    const current = currentStats[0] || { totalOrders: 0, totalRevenue: 0, completedOrders: 0 };
    const previous = previousStats[0] || { totalOrders: 0, totalRevenue: 0, completedOrders: 0 };

    const averageTicket = current.completedOrders > 0 ? current.totalRevenue / current.completedOrders : 0;
    const prevAverageTicket = previous.completedOrders > 0 ? previous.totalRevenue / previous.completedOrders : 0;

    const serviceOrdersChange = previous.totalOrders > 0 ? 
      ((current.totalOrders - previous.totalOrders) / previous.totalOrders) * 100 : 0;
    const revenueChange = previous.totalRevenue > 0 ? 
      ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0;
    const clientsChange = prevActiveClients.length > 0 ? 
      ((activeClients.length - prevActiveClients.length) / prevActiveClients.length) * 100 : 0;
    const ticketChange = prevAverageTicket > 0 ? 
      ((averageTicket - prevAverageTicket) / prevAverageTicket) * 100 : 0;

    const criticalAlerts = await this.getCriticalAlerts(garageId);

    return {
      totalServiceOrders: current.totalOrders,
      monthlyRevenue: current.totalRevenue,
      activeClients: activeClients.length,
      averageTicket,
      serviceOrdersChange,
      revenueChange,
      clientsChange,
      ticketChange,
      criticalAlerts
    };
  }

  async getServiceOrdersStats(garageId: string, period?: string): Promise<ServiceOrdersStats> {
    const garageObjectId = new mongoose.Types.ObjectId(garageId);
    const periodFilter = period ? this.getPeriodDates(period) : null;

    const matchCondition: any = { garageId: garageObjectId };
    if (periodFilter) {
      matchCondition.createdAt = { $gte: periodFilter.startDate, $lte: periodFilter.endDate };
    }

    const statusDistribution = await ServiceOrderModel.aggregate([
      { $match: matchCondition },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const completionTimes = await ServiceOrderModel.aggregate([
      { 
        $match: { 
          ...matchCondition,
          status: ServiceOrderStatus.COMPLETED,
          completionDate: { $exists: true }
        }
      },
      {
        $addFields: {
          completionDays: {
            $divide: [
              { $subtract: ['$completionDate', '$openingDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgCompletionTime: { $avg: '$completionDays' }
        }
      }
    ]);

    const approvalStats = await ServiceOrderModel.aggregate([
      { 
        $match: { 
          ...matchCondition,
          budgetApprovalStatus: { $in: ['aprovado', 'rejeitado'] }
        }
      },
      {
        $group: {
          _id: null,
          totalBudgets: { $sum: 1 },
          approvedBudgets: { $sum: { $cond: [
            { $eq: ['$budgetApprovalStatus', 'aprovado'] },
            1,
            0
          ]}}
        }
      }
    ]);

    const approvalData = approvalStats[0] || { totalBudgets: 0, approvedBudgets: 0 };
    const approvalRate = approvalData.totalBudgets > 0 ? 
      (approvalData.approvedBudgets / approvalData.totalBudgets) * 100 : 0;

    return {
      statusDistribution: statusDistribution.map(item => ({
        status: item._id,
        count: item.count
      })),
      averageCompletionTime: completionTimes[0]?.avgCompletionTime || 0,
      approvalRate,
      totalOrders: statusDistribution.reduce((sum, item) => sum + item.count, 0)
    };
  }

  async getFinancialStats(garageId: string, period?: string): Promise<FinancialStats> {
    const garageObjectId = new mongoose.Types.ObjectId(garageId);
    const periodFilter = period ? this.getPeriodDates(period) : null;

    const matchCondition: any = { 
      garageId: garageObjectId,
      status: ServiceOrderStatus.COMPLETED
    };
    if (periodFilter) {
      matchCondition.completionDate = { $gte: periodFilter.startDate, $lte: periodFilter.endDate };
    }

    const revenueStats = await ServiceOrderModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalTotal' },
          totalOrders: { $sum: 1 },
          totalParts: { $sum: '$finalTotalParts' },
          totalServices: { $sum: '$finalTotalServices' }
        }
      }
    ]);

    const revenueByPeriod = await ServiceOrderModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: {
            year: { $year: '$completionDate' },
            month: { $month: '$completionDate' },
            day: { $dayOfMonth: '$completionDate' }
          },
          revenue: { $sum: '$finalTotal' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const paymentMethodDistribution = await ServiceOrderModel.aggregate([
      { $match: { ...matchCondition, paymentMethod: { $exists: true } } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalValue: { $sum: '$finalTotal' }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    const revenueData = revenueStats[0] || { 
      totalRevenue: 0, 
      totalOrders: 0, 
      totalParts: 0, 
      totalServices: 0 
    };

    const averageTicket = revenueData.totalOrders > 0 ? 
      revenueData.totalRevenue / revenueData.totalOrders : 0;

    const estimatedCosts = (revenueData.totalParts * 0.7) + (revenueData.totalServices * 0.2);
    const profitMargin = revenueData.totalRevenue > 0 ? 
      ((revenueData.totalRevenue - estimatedCosts) / revenueData.totalRevenue) * 100 : 0;

    return {
      totalRevenue: revenueData.totalRevenue,
      averageTicket,
      profitMargin,
      revenueByPeriod: revenueByPeriod.map(item => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        revenue: item.revenue,
        orderCount: item.orderCount
      })),
      paymentMethodDistribution: paymentMethodDistribution.map(item => ({
        method: item._id,
        count: item.count,
        totalValue: item.totalValue
      }))
    };
  }

  async getTodaySchedule(garageId: string): Promise<ScheduleEvent[]> {
    const garageObjectId = new mongoose.Types.ObjectId(garageId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = await ScheduleEventModel.aggregate([
      {
        $match: {
          garageId: garageObjectId,
          date: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicleId',
          foreignField: '_id',
          as: 'vehicle'
        }
      },
      {
        $addFields: {
          clientName: { $arrayElemAt: ['$client.name', 0] },
          vehiclePlate: { $arrayElemAt: ['$vehicle.plate', 0] }
        }
      },
      { $sort: { time: 1 } }
    ]);

    return events.map(event => ({
      id: event._id.toString(),
      title: event.title,
      time: event.time,
      clientName: event.clientName,
      vehiclePlate: event.vehiclePlate,
      status: event.status,
      serviceTag: event.serviceTag
    }));
  }

  private async getCriticalAlerts(garageId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const garageObjectId = new mongoose.Types.ObjectId(garageId);

    const criticalStock = await PartModel.aggregate([
      { $match: { garageId: garageObjectId } },
      {
        $lookup: {
          from: 'inventoryentries',
          let: { partId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$partId', '$$partId'] } } },
            {
              $group: {
                _id: null,
                currentStock: {
                  $sum: {
                    $cond: [
                      { $eq: ['$movementType', 'entry'] },
                      '$quantity',
                      { $multiply: ['$quantity', -1] }
                    ]
                  }
                }
              }
            }
          ],
          as: 'stockInfo'
        }
      },
      {
        $addFields: {
          currentStock: { $ifNull: [{ $arrayElemAt: ['$stockInfo.currentStock', 0] }, 0] }
        }
      },
      {
        $match: {
          $expr: { $lt: ['$currentStock', '$minimumStock'] }
        }
      }
    ]);

    criticalStock.forEach(part => {
      alerts.push({
        type: 'warning',
        title: 'Estoque Baixo',
        message: `${part.name} está abaixo do estoque mínimo (${part.currentStock}/${part.minimumStock})`,
        action: 'Ver Estoque',
        actionUrl: '/system/inventory/stock'
      });
    });

    const overdueOrders = await ServiceOrderModel.countDocuments({
      garageId: garageObjectId,
      status: { $in: [ServiceOrderStatus.IN_PROGRESS, ServiceOrderStatus.WAITING_PARTS] },
      estimatedCompletionDate: { $lt: new Date() }
    });

    if (overdueOrders > 0) {
      alerts.push({
        type: 'danger',
        title: 'Ordens Atrasadas',
        message: `${overdueOrders} ordem(ns) de serviço estão atrasadas`,
        action: 'Ver Ordens',
        actionUrl: '/system/service-orders'
      });
    }

    return alerts;
  }

  async getOperationalStats(garageId: string, period?: string): Promise<OperationalStats> {
    const garageObjectId = new mongoose.Types.ObjectId(garageId);
    const periodFilter = period ? this.getPeriodDates(period) : null;

    const matchCondition: any = { garageId: garageObjectId };
    if (periodFilter) {
      matchCondition.createdAt = { $gte: periodFilter.startDate, $lte: periodFilter.endDate };
    }


    const productivityStats = await ServiceOrderModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [
            { $eq: ['$status', ServiceOrderStatus.COMPLETED] },
            '$finalTotal',
            0
          ]}},
          totalDays: { $sum: { $cond: [
            { $eq: ['$status', ServiceOrderStatus.COMPLETED] },
            { $divide: [
              { $subtract: ['$completionDate', '$createdAt'] },
              1000 * 60 * 60 * 24
            ]},
            0
          ]}}
        }
      }
    ]);


    const scheduleStats = await ScheduleEventModel.aggregate([
      { 
        $match: { 
          garageId: garageObjectId,
          ...(periodFilter && { date: { $gte: periodFilter.startDate, $lte: periodFilter.endDate } })
        }
      },
      {
        $group: {
          _id: null,
          totalScheduled: { $sum: 1 },
          completedEvents: { $sum: { $cond: [
            { $eq: ['$status', EventStatus.COMPLETED] },
            1,
            0
          ]}},
          noShowEvents: { $sum: { $cond: [
            { $eq: ['$status', EventStatus.NO_SHOW] },
            1,
            0
          ]}}
        }
      }
    ]);


    const serviceDistribution = await ServiceOrderModel.aggregate([
      { $match: { ...matchCondition, status: ServiceOrderStatus.COMPLETED } },
      { $unwind: '$services' },
      {
        $group: {
          _id: '$services.name',
          count: { $sum: 1 },
          revenue: { $sum: '$services.total' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const productivity = productivityStats[0] || { totalOrders: 0, totalRevenue: 0, totalDays: 0 };
    const schedule = scheduleStats[0] || { totalScheduled: 0, completedEvents: 0, noShowEvents: 0 };

    const daysInPeriod = periodFilter ? 
      Math.ceil((periodFilter.endDate.getTime() - periodFilter.startDate.getTime()) / (1000 * 60 * 60 * 24)) : 30;

    const ordersPerDay = productivity.totalOrders > 0 ? productivity.totalOrders / daysInPeriod : 0;
    const revenuePerDay = productivity.totalRevenue > 0 ? productivity.totalRevenue / daysInPeriod : 0;

    const scheduledVsRealized = schedule.totalScheduled > 0 ? 
      (schedule.completedEvents / schedule.totalScheduled) * 100 : 0;
    const noShowRate = schedule.totalScheduled > 0 ? 
      (schedule.noShowEvents / schedule.totalScheduled) * 100 : 0;

    return {
      productivity: {
        ordersPerDay: Math.round(ordersPerDay * 100) / 100,
        revenuePerDay: Math.round(revenuePerDay * 100) / 100
      },
      schedule: {
        scheduledVsRealized: Math.round(scheduledVsRealized * 100) / 100,
        noShowRate: Math.round(noShowRate * 100) / 100
      },
      serviceDistribution: serviceDistribution.map(item => ({
        service: item._id || 'Serviço não especificado',
        count: item.count,
        revenue: item.revenue
      }))
    };
  }

  async getInventoryStats(garageId: string): Promise<InventoryStats> {
    const garageObjectId = new mongoose.Types.ObjectId(garageId);

    const allParts = await PartModel.aggregate([
      { $match: { garageId: garageObjectId } },
      {
        $lookup: {
          from: 'inventoryentries',
          let: { partId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$partId', '$$partId'] } } },
            {
              $group: {
                _id: null,
                currentStock: { $sum: '$quantity' }
              }
            }
          ],
          as: 'stockInfo'
        }
      },
      {
        $addFields: {
          currentStock: { $ifNull: [{ $arrayElemAt: ['$stockInfo.currentStock', 0] }, 0] }
        }
      }
    ]);

    const totalItems = allParts.reduce((sum, part) => sum + part.currentStock, 0);
    const totalValue = allParts.reduce((sum, part) => {
      return sum + (part.currentStock * (part.averageCost || part.costPrice || 0));
    }, 0);

    const lowStockItems = allParts.filter(part => 
      part.currentStock > 0 && part.currentStock <= (part.minimumStock || 0)
    ).length;

    const outOfStockItems = allParts.filter(part => 
      part.currentStock <= 0
    ).length;

    return {
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
      totalStockValue: totalValue,
      criticalItems: [],
      stockTurnover: 0,
      averageConsumptionPerOrder: 0
    };
  }

  /**
   * Retorna a contagem total de usuários cadastrados (garagens)
   * Usado pela API interna para o Discord bot
   */
  async getUsersCount(): Promise<number> {
    try {
      const count = await GarageModel.countDocuments({
        // Contar apenas garagens ativas
        isActive: true
      });
      return count;
    } catch (error) {
      console.error('Erro ao contar usuários:', error);
      return 0;
    }
  }
}