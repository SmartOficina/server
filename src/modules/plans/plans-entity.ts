import mongoose, { Schema, Document } from 'mongoose';

export interface PlanDocument extends Document {
    name: string;
    description: string;
    price: number;
    interval: 'monthly' | 'yearly';
    features: string[];
    permissions: string[];
    isActive: boolean;
}

const PlanSchema: Schema = new Schema({
    name: { type: String, required: [true, 'O nome do plano é obrigatório.'] },
    description: { type: String, required: [true, 'A descrição do plano é obrigatória.'] },
    price: { type: Number, required: [true, 'O preço do plano é obrigatório.'] },
    interval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    features: [{ type: String }],
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

export const PlanModel = mongoose.model<PlanDocument>('Plan', PlanSchema);