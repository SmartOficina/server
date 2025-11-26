import mongoose, { Document, Schema } from 'mongoose';

export enum EventStatus {
    SCHEDULED = 'scheduled',
    COMPLETED = 'completed',
    CANCELED = 'canceled',
    NO_SHOW = 'no_show'
}

export enum ServiceTag {
    MAINTENANCE = 'Manutenção',
    RETURN = 'Retorno',
    WARRANTY = 'Garantia',
    ACCESSORY = 'Acessório',
    ESTIMATE = 'Orçamento'
}

export interface ScheduleEventDocument extends Document {
    title: string;
    date: Date;
    time: string;
    duration: number;
    clientId?: string;
    vehicleId?: string;
    serviceTag: string;
    notes?: string;
    status: string;
    garageId: string;
    createdAt: Date;
    updatedAt?: Date;
}

const ScheduleEventSchema: Schema = new Schema({
    title: { type: String, required: [true, 'O título do agendamento é obrigatório.'] },
    date: { type: Date, required: [true, 'A data do agendamento é obrigatória.'] },
    time: { type: String, required: [true, 'A hora do agendamento é obrigatória.'] },
    duration: { type: Number, required: [true, 'A duração do agendamento é obrigatória.'], default: 60 },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: false },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: false },
    serviceTag: {
        type: String,
        enum: Object.values(ServiceTag),
        required: [true, 'A etiqueta de serviço é obrigatória.']
    },
    notes: { type: String, required: false },
    status: {
        type: String,
        enum: Object.values(EventStatus),
        required: true,
        default: EventStatus.SCHEDULED
    },
    garageId: { type: Schema.Types.ObjectId, ref: 'Garage', required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, required: false }
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

ScheduleEventSchema.index({ garageId: 1, date: 1 });
ScheduleEventSchema.index({ garageId: 1, clientId: 1 });
ScheduleEventSchema.index({ garageId: 1, vehicleId: 1 });
ScheduleEventSchema.index({ garageId: 1, status: 1 });

ScheduleEventSchema.virtual('client', { ref: 'Client', localField: 'clientId', foreignField: '_id', justOne: true });
ScheduleEventSchema.virtual('vehicle', { ref: 'Vehicle', localField: 'vehicleId', foreignField: '_id', justOne: true });

export const ScheduleEventModel = mongoose.model<ScheduleEventDocument>('ScheduleEvent', ScheduleEventSchema);