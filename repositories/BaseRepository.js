const DatabaseService = require('../services/DatabaseService');

class BaseRepository {
    constructor(model) {
        this.model = model;
        this.dbService = DatabaseService;
    }

    async create(data) {
        return await this.dbService.create(this.model, data);
    }

    async findById(id, populate) {
        return await this.dbService.findById(this.model, id, populate);
    }

    async findOne(conditions, populate) {
        return await this.dbService.findOne(this.model, conditions, populate);
    }

    async find(conditions, options) {
        return await this.dbService.find(this.model, conditions, options);
    }

    async update(id, data, options) {
        return await this.dbService.update(this.model, id, data, options);
    }

    async delete(id) {
        return await this.dbService.delete(this.model, id);
    }

    async paginate(conditions, options) {
        return await this.dbService.paginate(this.model, conditions, options);
    }

    async aggregate(pipeline) {
        return await this.dbService.aggregate(this.model, pipeline);
    }
}