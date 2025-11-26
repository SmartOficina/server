import mongoose, { Document, Schema } from 'mongoose';

export interface InventoryEntryDocument extends Document {
    partId: mongoose.Types.ObjectId;
    currentQuantity?: number;
    quantity: number;
    costPrice: number;
    profitMargin?: number;
    sellingPrice: number;
    invoiceNumber?: string;
    supplierId?: mongoose.Types.ObjectId;
    description?: string;
    garageId: mongoose.Types.ObjectId;
    entryDate: Date;
    movementType: 'entry' | 'exit';
    exitType?: 'service_order' | 'manual' | 'loss' | 'transfer';
    reference?: string;
    createdAt: Date;
    updatedAt: Date;
}

const InventoryEntrySchema: Schema = new Schema({
    partId: { type: Schema.Types.ObjectId, ref: 'Part', required: true },
    currentQuantity: { type: Number, required: false, default: 0 },
    quantity: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    profitMargin: { type: Number, required: false },
    sellingPrice: { type: Number, required: true },
    invoiceNumber: { type: String, required: false },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: false },
    description: { type: String, required: false },
    garageId: { type: Schema.Types.ObjectId, ref: 'Garage', required: true },
    entryDate: { type: Date, default: Date.now, required: true },
    movementType: { type: String, enum: ['entry', 'exit'], required: true, default: 'entry' },
    exitType: { type: String, enum: ['service_order', 'manual', 'loss', 'transfer'], required: false },
    reference: { type: String, required: false },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, default: Date.now, required: true }
});

InventoryEntrySchema.index({ garageId: 1, partId: 1 });
InventoryEntrySchema.index({ garageId: 1, supplierId: 1 });
InventoryEntrySchema.index({ garageId: 1, entryDate: -1 });
InventoryEntrySchema.index({ garageId: 1, movementType: 1 });
InventoryEntrySchema.index({ garageId: 1, exitType: 1 });

export const InventoryEntryModel = mongoose.model<InventoryEntryDocument>('InventoryEntry', InventoryEntrySchema);