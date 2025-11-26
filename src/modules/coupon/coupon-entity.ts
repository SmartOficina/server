import mongoose, { Schema, Document } from "mongoose";

export interface CouponDocument extends Document {
  code: string;
  usageLimit: number;
  discount: number;
  expirationDate: Date;
  planId: mongoose.Types.ObjectId | string;
  interval?: "monthly" | "yearly" | "both";
  isActive: boolean;
  createdAt: Date;
  usedBy: { userId: mongoose.Types.ObjectId; usedAt: Date }[];
}

const CouponSchema: Schema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  usageLimit: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  expirationDate: {
    type: Date,
    required: true,
  },
  planId: {
    type: Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(v: any) {
        return v === "todos" || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'planId deve ser um ObjectId válido ou a string "todos"'
    }
  },
  interval: {
    type: String,
    enum: ["monthly", "yearly", "both"],
    default: "both",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  usedBy: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

export const CouponModel = mongoose.model<CouponDocument>("Coupon", CouponSchema);
