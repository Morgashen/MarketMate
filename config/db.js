const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.ATLAS_URI || 'mongodb+srv://mashudumorgan:<db_password>@marketmate.tnup4.mongodb.net/?retryWrites=true&w=majority&appName=MarketMate';

        await mongoose.connect(mongoURI, {

        });

        console.log('MongoDB Connected Successfully');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;