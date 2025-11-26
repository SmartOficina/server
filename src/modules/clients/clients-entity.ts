import mongoose, { Document, Schema } from "mongoose";

export interface ClientDocument extends Document {
  fullName: string;
  cpfCnpj?: string;
  phone: string;
  email?: string;
  birthDate?: Date;
  gender?: string;
  photo?: string;
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  garageId: string;
  createdAt?: Date;
}

const ClientSchema: Schema = new Schema({
  fullName: { type: String, required: true },
  cpfCnpj: { type: String, required: false },
  phone: { type: String, required: true },
  email: { type: String, required: false },
  birthDate: { type: Date, required: false },
  gender: { type: String, required: false },
  photo: { type: String, required: false },
  address: {
    street: { type: String, required: false },
    number: { type: String, required: false },
    district: { type: String, required: false },
    city: { type: String, required: false },
    state: { type: String, required: false },
    zipCode: { type: String, required: false },
  },
  garageId: { type: Schema.Types.ObjectId, ref: "Garage", required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

ClientSchema.index({ garageId: 1, cpfCnpj: 1 }, { unique: true, partialFilterExpression: { cpfCnpj: { $exists: true, $ne: "" } } });
ClientSchema.index({ garageId: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true, $ne: "" } } });
ClientSchema.index({ garageId: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: "" } } });

ClientSchema.index({ garageId: 1, fullName: "text", "address.city": "text", "address.district": "text" });
ClientSchema.index({ garageId: 1, birthDate: 1 });
ClientSchema.index({ garageId: 1, createdAt: 1 });

ClientSchema.virtual("vehicles", { ref: "Vehicle", localField: "_id", foreignField: "clientId" });
ClientSchema.set("toObject", { virtuals: true });
ClientSchema.set("toJSON", { virtuals: true });

export const ClientModel = mongoose.model<ClientDocument>("Client", ClientSchema);
