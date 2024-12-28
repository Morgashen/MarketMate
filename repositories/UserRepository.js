const User = require('../models/User');
const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    async findByEmail(email) {
        return await this.findOne({ email });
    }

    async updateProfile(userId, profileData) {
        return await this.update(userId, profileData, { new: true });
    }

    async getUserWithAddresses(userId) {
        return await this.findById(userId, 'addresses');
    }
}