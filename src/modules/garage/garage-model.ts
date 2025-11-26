import { GarageModel, GarageDocument } from './garage-entity';

export class GarageModelHandler {
    static async find(search: string, limit: number, page: number): Promise<{ garages: GarageDocument[], totalPages: number }> {
        const query = { name: { $regex: search, $options: 'i' } };
        const totalGarages = await GarageModel.countDocuments(query);
        const totalPages = Math.ceil(totalGarages / limit);
        const garages = await GarageModel.find(query)
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();
        return { garages, totalPages };
    }

    static async create(garageData: Omit<GarageDocument, '_id'>): Promise<GarageDocument> {
        const newGarage = new GarageModel(garageData);
        return newGarage.save();
    }

    static async update(id: string, garageData: Partial<GarageDocument>): Promise<GarageDocument | null> {
        return GarageModel.findByIdAndUpdate(id, garageData, { new: true }).exec();
    }

    static async delete(id: string): Promise<boolean> {
        const result = await GarageModel.findByIdAndDelete(id).exec();
        return result !== null;
    }

    static async findByPhone(phone: string): Promise<GarageDocument | null> {
        return GarageModel.findOne({ phone }).exec();
    }

    static async findByEmail(email: string): Promise<GarageDocument | null> {
        return GarageModel.findOne({ email }).exec();
    }

    static async findById(id: string): Promise<GarageDocument | null> {
        return GarageModel.findById(id).exec();
    }

    static async findByCnpjCpf(cnpjCpf: string): Promise<GarageDocument | null> {
        return GarageModel.findOne({ cnpjCpf }).exec();
    }

    static async findByActivationCode(activationCode: string): Promise<GarageDocument | null> {
        return GarageModel.findOne({ activationCode }).exec();
    }
}