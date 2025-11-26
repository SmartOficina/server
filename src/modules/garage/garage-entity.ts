import mongoose, { Schema, Document } from 'mongoose';

export interface GarageDocument extends Document {
    name: string;
    cnpjCpf: string;
    phone: string;
    email: string;
    password: string;
    photo?: string;
    address?: {
        street?: string;
        number?: string;
        district?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
    activationCode?: string | null;
    activationCodeExpiresAt?: Date | null;
    activationAttempts?: number;
    isActive?: boolean;
    planId?: mongoose.Types.ObjectId;
    planExpiresAt?: Date;
    isRegistrationComplete?: boolean;
    lastAccessAt?: Date;
    lastLoginIp?: string;
    onlineStatus?: 'online' | 'offline';
    lastActivityAt?: Date;
}

const GarageSchema: Schema = new Schema({
    name: { type: String, required: [true, 'O campo nome é obrigatório.'] },
    cnpjCpf: { type: String, required: [true, 'O campo CNPJ ou CPF é obrigatório.'], unique: true },
    phone: { type: String, required: [true, 'O campo Celular é obrigatório.'] },
    email: { type: String, required: [true, 'O campo E-mail é obrigatório.'], unique: true },
    password: { type: String, required: [true, 'O campo Senha é obrigatório.'] },
    photo: { type: String, required: false },
    address: {
        street: { type: String, required: false },
        number: { type: String, required: false },
        district: { type: String, required: false },
        city: { type: String, required: false },
        state: { type: String, required: false },
        zipCode: { type: String, required: false }
    },
    activationCode: { type: String, required: false },
    activationCodeExpiresAt: { type: Date, required: false },
    activationAttempts: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: false },
    planExpiresAt: { type: Date, required: false },
    isRegistrationComplete: { type: Boolean, default: false },
    lastAccessAt: { type: Date, required: false },
    lastLoginIp: { type: String, required: false },
    onlineStatus: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    lastActivityAt: { type: Date, required: false },
    createdAt: { type: Date, default: Date.now }
});

GarageSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.password;
        delete ret.activationAttempts;
        delete ret.activationCode;
        delete ret.activationCodeExpiresAt;
        return ret;
    }
});

export const GarageModel = mongoose.model<GarageDocument>('Garage', GarageSchema);