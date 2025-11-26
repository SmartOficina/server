import mongoose, { Document, Schema } from "mongoose";
import crypto from "crypto";

export enum ServiceOrderStatus {
  OPENED = "aberta",
  DIAGNOSING = "em_diagnostico",
  WAITING_APPROVAL = "aguardando_aprovacao",
  APPROVED = "aprovada",
  REJECTED = "rejeitada",
  IN_PROGRESS = "em_andamento",
  WAITING_PARTS = "aguardando_pecas",
  COMPLETED = "concluida",
  DELIVERED = "entregue",
  CANCELED = "cancelada",
}

export enum PaymentMethod {
  CASH = "dinheiro",
  CREDIT_CARD = "cartao_credito",
  DEBIT_CARD = "cartao_debito",
  PIX_PF = "pix_pf",
  PIX_PJ = "pix_pj",
  BANK_TRANSFER = "transferencia",
  INSTALLMENT = "parcelado",
}

export interface PartItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  formattedUnitPrice?: string;
}

export interface ServiceItem {
  description: string;
  estimatedHours: number;
  pricePerHour: number;
  totalPrice: number;
  formattedPricePerHour?: string;
}

export interface MechanicWork {
  mechanicId: string;
  startTime: Date;
  endTime?: Date;
  totalHours?: number;
  notes?: string;
}

export interface ChecklistItem {
  description: string;
  checked: boolean;
  notes?: string;
}

export interface BudgetApproval {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  decision?: "approved" | "rejected";
  rejectionReason?: string;
}

export interface ServiceOrderDocument extends Document {
  orderNumber?: string;
  vehicleId: string;
  openingDate: Date;
  currentMileage: number;
  reportedProblem: string;
  entryChecklist: ChecklistItem[];
  fuelLevel?: number;
  visibleDamages?: string[];
  identifiedProblems?: string[];
  requiredParts?: PartItem[];
  services?: ServiceItem[];
  estimatedCompletionDate?: Date;
  estimatedTotalParts?: number;
  estimatedTotalServices?: number;
  estimatedTotal?: number;
  budgetApprovalStatus?: string;
  budgetApprovalDate?: Date;
  budgetApproval?: BudgetApproval;
  status: ServiceOrderStatus;
  statusHistory?: {
    status: ServiceOrderStatus;
    date: Date;
    notes?: string;
  }[];
  usedParts?: PartItem[];
  mechanicWorks?: MechanicWork[];
  technicalObservations?: string;
  exitChecklist?: ChecklistItem[];
  testDrive?: {
    performed: boolean;
    date?: Date;
    notes?: string;
  };
  invoiceNumber?: string;
  invoiceDate?: Date;
  paymentMethod?: PaymentMethod;
  finalTotalParts?: number;
  finalTotalServices?: number;
  finalTotal?: number;
  completionDate?: Date;
  deliveryDate?: Date;
  garageId: string;
  createdAt: Date;
  updatedAt?: Date;
}

const BudgetApprovalSchema = new Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  usedAt: { type: Date },
  decision: { type: String, enum: ["approved", "rejected"] },
  rejectionReason: { type: String },
});

const ServiceOrderSchema: Schema = new Schema(
  {
    orderNumber: { type: String, required: false },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    openingDate: { type: Date, required: true, default: Date.now },
    currentMileage: { type: Number, required: false },
    reportedProblem: { type: String, required: true },
    entryChecklist: [
      {
        description: { type: String, required: true },
        checked: { type: Boolean, required: true },
        notes: { type: String, required: false },
      },
    ],
    fuelLevel: { type: Number, required: false, min: 0, max: 100 },
    visibleDamages: [{ type: String, required: false }],
    identifiedProblems: [{ type: String, required: false }],
    requiredParts: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
        partId: { type: Schema.Types.ObjectId, ref: "Part", required: false },
        fromInventory: { type: Boolean, default: false },
        code: { type: String, required: false },
      },
    ],
    services: [
      {
        description: { type: String, required: true },
        estimatedHours: { type: Number, required: true },
        pricePerHour: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
      },
    ],
    estimatedCompletionDate: { type: Date, required: false },
    estimatedTotalParts: { type: Number, required: false },
    estimatedTotalServices: { type: Number, required: false },
    estimatedTotal: { type: Number, required: false },
    budgetApprovalStatus: {
      type: String,
      required: false,
      enum: ["aguardando", "aprovado", "rejeitado"],
      default: "aguardando",
    },
    budgetApprovalDate: { type: Date, required: false },
    budgetApproval: { type: BudgetApprovalSchema, required: false },
    status: {
      type: String,
      enum: Object.values(ServiceOrderStatus),
      required: true,
      default: ServiceOrderStatus.OPENED,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: Object.values(ServiceOrderStatus),
          required: true,
        },
        date: { type: Date, required: true, default: Date.now },
        notes: { type: String, required: false },
      },
    ],
    usedParts: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
      },
    ],
    mechanicWorks: [
      {
        mechanicId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        startTime: { type: Date, required: true },
        endTime: { type: Date, required: false },
        totalHours: { type: Number, required: false },
        notes: { type: String, required: false },
      },
    ],
    technicalObservations: { type: String, required: false },
    exitChecklist: [
      {
        description: { type: String, required: true },
        checked: { type: Boolean, required: true },
        notes: { type: String, required: false },
      },
    ],
    testDrive: {
      performed: { type: Boolean, required: false },
      date: { type: Date, required: false },
      notes: { type: String, required: false },
    },
    invoiceNumber: { type: String, required: false },
    invoiceDate: { type: Date, required: false },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: false,
    },
    finalTotalParts: { type: Number, required: false },
    finalTotalServices: { type: Number, required: false },
    finalTotal: { type: Number, required: false },
    completionDate: { type: Date, required: false },
    deliveryDate: { type: Date, required: false },
    garageId: { type: Schema.Types.ObjectId, ref: "Garage", required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, required: false },
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ServiceOrderSchema.index({ garageId: 1, vehicleId: 1, openingDate: 1 });
ServiceOrderSchema.index({ garageId: 1, status: 1 });
ServiceOrderSchema.index({ garageId: 1, orderNumber: 1 }, { unique: true, sparse: true });
ServiceOrderSchema.index({ garageId: 1, "budgetApproval.token": 1 }, { unique: true, partialFilterExpression: { "budgetApproval.token": { $exists: true, $ne: null } } });

ServiceOrderSchema.virtual("vehicle", { ref: "Vehicle", localField: "vehicleId", foreignField: "_id", justOne: true });

ServiceOrderSchema.statics.generateBudgetApprovalToken = function (): string {
  return crypto.randomBytes(32).toString("hex");
};

export const ServiceOrderModel = mongoose.model<ServiceOrderDocument>("ServiceOrder", ServiceOrderSchema);
