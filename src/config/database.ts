import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'prod';

const connectDB = async () => {
    const mongoUrl = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV
    try {
        if (!mongoUrl) {
            console.error('❌ MongoDB URL não configurada');
            process.exit(1);
        }
        
        console.log('🔗 Conectando ao MongoDB...');
        await mongoose.connect(mongoUrl);
        console.log('✅ MongoDB conectado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
};

export default connectDB;