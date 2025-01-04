const mongoose = require('mongoose');
let isConnected = false;

const connectDB = async () => {
    try {
        if (isConnected) {
            return;
        }

        const mongoURI = process.env.ATLAS_URI || 'mongodb+srv://mashudumorgan:<db_password>@marketmate.tnup4.mongodb.net/?retryWrites=true&w=majority&appName=MarketMate';

        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            retryWrites: true,
            w: 'majority'
        });

        isConnected = true;
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;