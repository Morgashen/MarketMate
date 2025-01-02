const mongoose = require('mongoose');
const config = require('config');

async function verifyDatabase() {
    try {
        await mongoose.connect(config.get('mongoURI'));
        console.log('Connected to MongoDB');

        // Check collections
        console.log('\nCollections:');
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });

        // Check users
        const users = await mongoose.connection.db.collection('users').find().toArray();
        console.log('\nUsers:', users.length);
        users.forEach(user => {
            console.log(`- ${user.email}`);
        });

        // Check products
        const products = await mongoose.connection.db.collection('products').find().toArray();
        console.log('\nProducts:', products.length);
        products.forEach(product => {
            console.log(`- ${product.name}: ${product.price}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Database verification error:', error);
    }
}

verifyDatabase();