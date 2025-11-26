import { ScheduleEventModel, ScheduleEventDocument } from './schedule-entity';
import { removeEmptyFields } from '../../core/utils/data-utils';
import mongoose from 'mongoose';

interface PopulatedScheduleEvent {
    _id: string;
    clientId?: string;
    vehicleId?: string;
    client?: any;
    vehicle?: any;
    [key: string]: any;
}

export class ScheduleModel {
    static async find(
        startDate: Date,
        endDate: Date,
        garageId: string
    ): Promise<{ events: any[], totalItems: number }> {
        const queryConditions: any = {
            garageId,
            date: {
                $gte: startDate,
                $lte: endDate
            }
        };

        const totalItems = await ScheduleEventModel.countDocuments(queryConditions);

        const events = await ScheduleEventModel.find(queryConditions)
            .populate('client')
            .populate('vehicle')
            .sort({ date: 1, time: 1 })
            .lean()
            .exec() as unknown as PopulatedScheduleEvent[];

        const processedEvents = await this.enhanceEventsWithClientVehicle(events);

        return {
            events: processedEvents,
            totalItems
        };
    }

    static async create(eventData: Partial<ScheduleEventDocument>, garageId: string): Promise<ScheduleEventDocument> {
        try {
            const sanitizedData = removeEmptyFields(eventData);

            const newEvent = new ScheduleEventModel({
                ...sanitizedData,
                garageId,
                createdAt: new Date()
            });

            return await newEvent.save();
        } catch (error) {
            throw error;
        }
    }

    static async update(id: string, eventData: Partial<ScheduleEventDocument>, garageId: string): Promise<any> {
        try {
            const dataWithTimestamp = {
                ...eventData,
                updatedAt: new Date()
            };

            const updatedEvent = await ScheduleEventModel.findOneAndUpdate(
                { _id: id, garageId },
                dataWithTimestamp,
                { new: true }
            )
                .populate('client')
                .populate('vehicle')
                .lean()
                .exec() as unknown as PopulatedScheduleEvent;

            return this.enhanceEventWithClientVehicle(updatedEvent);
        } catch (error) {
            return null;
        }
    }

    static async delete(id: string, garageId: string): Promise<boolean> {
        try {
            const result = await ScheduleEventModel.findOneAndDelete({ _id: id, garageId }).exec();
            return result !== null;
        } catch (error) {
            return false;
        }
    }

    static async updateStatus(id: string, status: string, garageId: string): Promise<any> {
        try {
            const updatedEvent = await ScheduleEventModel.findOneAndUpdate(
                { _id: id, garageId },
                {
                    status,
                    updatedAt: new Date()
                },
                { new: true }
            )
                .select('_id status updatedAt')
                .lean()
                .exec();

            return updatedEvent;
        } catch (error) {
            return null;
        }
    }

    private static async enhanceEventsWithClientVehicle(events: PopulatedScheduleEvent[]): Promise<PopulatedScheduleEvent[]> {
        for (const event of events) {
            await this.enhanceEventWithClientVehicle(event);
        }
        return events;
    }

    private static async enhanceEventWithClientVehicle(event: PopulatedScheduleEvent): Promise<PopulatedScheduleEvent> {
        try {
            if (!event) return event;

            if (!event.client && event.vehicleId) {
                const VehicleModel = mongoose.model('Vehicle');
                const vehicle = await VehicleModel.findById(event.vehicleId)
                    .populate('clientId')
                    .lean()
                    .exec();

                if (vehicle && (vehicle as any).clientId) {
                    event.client = (vehicle as any).clientId;
                }
            }

            return event;
        } catch (error) {
            return event;
        }
    }
}