export interface OverviewData {
  totalServiceOrders: number;
  monthlyRevenue: number;
  activeClients: number;
  averageTicket: number;
  serviceOrdersChange: number;
  revenueChange: number;
  clientsChange: number;
  ticketChange: number;
  criticalAlerts: Alert[];
}

export interface ServiceOrdersStats {
  statusDistribution: StatusCount[];
  averageCompletionTime: number;
  approvalRate: number;
  totalOrders: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface FinancialStats {
  totalRevenue: number;
  averageTicket: number;
  profitMargin: number;
  revenueByPeriod: RevenuePoint[];
  paymentMethodDistribution: PaymentMethodCount[];
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface PaymentMethodCount {
  method: string;
  count: number;
  totalValue: number;
}

export interface OperationalStats {
  productivity: {
    ordersPerDay: number;
    revenuePerDay: number;
  };
  schedule: {
    scheduledVsRealized: number;
    noShowRate: number;
  };
  serviceDistribution: ServiceDistribution[];
}

export interface ServiceDistribution {
  service: string;
  count: number;
  revenue: number;
}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalStockValue: number;
  criticalItems: CriticalInventoryItem[];
  stockTurnover: number;
  averageConsumptionPerOrder: number;
}

export interface CriticalInventoryItem {
  partId: string;
  name: string;
  currentStock: number;
  minimumStock: number;
  category?: string;
}

export interface Alert {
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action?: string;
  actionUrl?: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  time: string;
  clientName?: string;
  vehiclePlate?: string;
  status: string;
  serviceTag: string;
}

export interface PeriodFilter {
  startDate: Date;
  endDate: Date;
}