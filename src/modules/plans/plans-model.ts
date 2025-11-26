import { PlanModel, PlanDocument } from './plans-entity';

export class PlanModelHandler {
    static async findAll(includeInactive: boolean = false): Promise<PlanDocument[]> {
        const query = includeInactive ? {} : { isActive: true };
        return PlanModel.find(query).sort({ price: 1 }).exec();
    }

    static async findById(id: string): Promise<PlanDocument | null> {
        return PlanModel.findById(id).exec();
    }

    static async create(planData: Omit<PlanDocument, '_id'>): Promise<PlanDocument> {
        const newPlan = new PlanModel(planData);
        return newPlan.save();
    }

    static async update(id: string, planData: Partial<PlanDocument>): Promise<PlanDocument | null> {
        return PlanModel.findByIdAndUpdate(id, planData, { new: true }).exec();
    }

    static async delete(id: string): Promise<boolean> {
        const result = await PlanModel.findByIdAndDelete(id).exec();
        return result !== null;
    }
}