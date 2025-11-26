import mongoose, { Document, Schema } from "mongoose";

export interface PartDocument extends Document {
  code: string;
  name: string;
  category?: string;
  sellingPrice?: number;
  costPrice?: number;
  averageCost?: number;
  profitMargin?: number;
  minimumStock?: number;
  unit: string;
  location?: string;
  barcode?: string;
  manufacturerCode?: string;
  ncmCode?: string;
  cfopCode?: string;
  anpCode?: string;
  anpDescription?: string;
  anpConsumptionState?: string;
  cestCode?: string;
  garageId: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartSchema: Schema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: false },
  sellingPrice: { type: Number, required: false, default: 0 },
  costPrice: { type: Number, required: false, default: 0 },
  averageCost: { type: Number, required: false, default: 0 },
  profitMargin: { type: Number, required: false, default: 0 },
  minimumStock: { type: Number, required: false, default: 0 },
  unit: { type: String, required: true },
  location: { type: String, required: false },
  barcode: { type: String, required: false },
  manufacturerCode: { type: String, required: false },
  ncmCode: { type: String, required: false },
  cfopCode: { type: String, required: false },
  anpCode: { type: String, required: false },
  anpDescription: { type: String, required: false },
  anpConsumptionState: { type: String, required: false },
  cestCode: { type: String, required: false },
  garageId: { type: Schema.Types.ObjectId, ref: "Garage", required: true },
  createdAt: { type: Date, default: Date.now, required: true },
  updatedAt: { type: Date, default: Date.now, required: true },
});

PartSchema.index({ garageId: 1, code: 1 }, { unique: true });

PartSchema.virtual("inventoryEntries", {
  ref: "InventoryEntry",
  localField: "_id",
  foreignField: "partId",
});

PartSchema.set("toObject", { virtuals: true });
PartSchema.set("toJSON", { virtuals: true });

export const PartModel = mongoose.model<PartDocument>("Part", PartSchema);
