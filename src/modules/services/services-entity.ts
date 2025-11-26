import mongoose, { Document, Schema } from "mongoose";

export interface ServiceDocument extends Document {
  code: string;
  name: string;
  sellingPrice: number;
  profitMargin: number;
  costPrice: number;
  garageId: string;
  createdAt?: Date;
}

const ServiceSchema: Schema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  sellingPrice: { type: Number, required: false, default: 0 },
  profitMargin: { type: Number, required: false, default: 30 },
  costPrice: { type: Number, required: false, default: 0 },
  garageId: { type: Schema.Types.ObjectId, ref: "Garage", required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

ServiceSchema.index({ garageId: 1, code: 1 }, { unique: true });

export const ServiceModel = mongoose.model<ServiceDocument>("Service", ServiceSchema);
