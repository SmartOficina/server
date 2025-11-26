import mongoose, { Document, Schema } from 'mongoose';

export interface CreditCardTokenDocument extends Document {
    garageId: mongoose.Types.ObjectId;
    token: string;
    lastFourDigits: string;
    cardBrand: string;
    holderName: string;
    expiryMonth: string;
    expiryYear: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt?: Date;
}

const CreditCardTokenSchema: Schema = new Schema({
    garageId: { type: Schema.Types.ObjectId, ref: 'Garage', required: true },
    token: { type: String, required: true },
    lastFourDigits: { type: String, required: true },
    cardBrand: { type: String, required: true },
    holderName: { type: String, required: true },
    expiryMonth: { type: String, required: true },
    expiryYear: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, required: false }
});

CreditCardTokenSchema.index({ garageId: 1 });

export const CreditCardTokenModel = mongoose.model<CreditCardTokenDocument>(
    'CreditCardToken',
    CreditCardTokenSchema
);