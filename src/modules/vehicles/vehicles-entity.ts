import mongoose, { Document, Schema } from "mongoose";

export interface VehicleDocument extends Document {
  clientId: string;
  licensePlate: string;
  brandModel: string;
  yearOfManufacture: number;
  color: string;
  chassisNumber: string;
  garageId: string;
  createdAt?: Date;
}

const VehicleSchema: Schema = new Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  licensePlate: { type: String, required: true },
  brandModel: { type: String, required: false },
  yearOfManufacture: { type: Number, required: false },
  color: { type: String, required: false },
  chassisNumber: { type: String, required: false },
  garageId: { type: mongoose.Schema.Types.ObjectId, ref: "Garage", required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

VehicleSchema.index({ garageId: 1, licensePlate: 1 }, { unique: true, partialFilterExpression: { licensePlate: { $exists: true, $ne: "" } } });
VehicleSchema.index({ garageId: 1, createdAt: 1 });

export const VehicleModel = mongoose.model<VehicleDocument>("Vehicle", VehicleSchema);
