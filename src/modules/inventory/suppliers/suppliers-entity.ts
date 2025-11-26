import mongoose, { Document, Schema } from 'mongoose';

export interface SupplierDocument extends Document {
    code: string;
    name: string;
    cnpj: string;
    mobile?: string;
    phone: string;
    email?: string;
    address: {
        street?: string;
        number?: string;
        district?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
    description?: string;
    garageId: string;
    createdAt: Date;
    updatedAt: Date;
}

const SupplierSchema: Schema = new Schema({
    code: { type: String, required: true },
    name: { type: String, required: true },
    cnpj: { type: String, required: true },
    mobile: { type: String, required: false },
    phone: { type: String, required: true },
    email: { type: String, required: false },
    address: {
        street: { type: String, required: false },
        number: { type: String, required: false },
        district: { type: String, required: false },
        city: { type: String, required: false },
        state: { type: String, required: false },
        zipCode: { type: String, required: false }
    },
    description: { type: String, required: false },
    garageId: { type: Schema.Types.ObjectId, ref: 'Garage', required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, default: Date.now, required: true }
});

SupplierSchema.index(
    { garageId: 1, code: 1 },
    { unique: true }
);

SupplierSchema.index(
    { garageId: 1, cnpj: 1 },
    { unique: true }
);

SupplierSchema.virtual('inventoryEntries', {
    ref: 'InventoryEntry',
    localField: '_id',
    foreignField: 'supplierId'
});

SupplierSchema.set('toObject', { virtuals: true });
SupplierSchema.set('toJSON', { virtuals: true });

export const SupplierModel = mongoose.model<SupplierDocument>('Supplier', SupplierSchema);