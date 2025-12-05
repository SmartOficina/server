import mongoose, { Document, Schema } from "mongoose";

export interface SubscriptionDocument extends Document {
  garageId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  isRenewal: boolean;
  previousSubscriptionId?: mongoose.Types.ObjectId;
  renewalCount: number;
  paymentReference?: string;
  invoiceNumber?: string;
  canceledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt?: Date;

  previousPlanId?: mongoose.Types.ObjectId;
  proRatedCredit?: number;
  planChangeType?: PlanChangeType;
  couponId?: mongoose.Types.ObjectId;
  isTrial?: boolean;
  trialStartDate?: Date;
  trialEndDate?: Date;
}

export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELED = "canceled",
  EXPIRED = "expired",
  PENDING = "pending",
}

export enum PaymentStatus {
  PAID = "paid",
  PENDING = "pending",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export enum PlanChangeType {
  UPGRADE = "upgrade",
  RENEWAL = "renewal",
  NEW = "new",
}

const SubscriptionSchema: Schema = new Schema({
  garageId: { type: Schema.Types.ObjectId, ref: "Garage", required: true },
  planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: Object.values(SubscriptionStatus),
    required: true,
    default: SubscriptionStatus.PENDING,
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING,
  },
  paymentMethod: { type: String, required: true },
  isRenewal: { type: Boolean, default: false },
  previousSubscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: false },
  renewalCount: { type: Number, default: 0 },
  paymentReference: { type: String, required: false },
  invoiceNumber: { type: String, required: false },
  canceledAt: { type: Date, required: false },
  cancelReason: { type: String, required: false },
  createdAt: { type: Date, default: Date.now, required: true },
  updatedAt: { type: Date, required: false },

  previousPlanId: { type: Schema.Types.ObjectId, ref: "Plan", required: false },
  proRatedCredit: { type: Number, required: false },
  planChangeType: {
    type: String,
    enum: Object.values(PlanChangeType),
    required: false,
  },
  couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: false },

  isTrial: { type: Boolean, default: false, required: false },
  trialStartDate: { type: Date, required: false },
  trialEndDate: { type: Date, required: false },
});

SubscriptionSchema.index({ garageId: 1, status: 1 });
SubscriptionSchema.index({ endDate: 1, status: 1 });

export const SubscriptionModel = mongoose.model<SubscriptionDocument>("Subscription", SubscriptionSchema);
