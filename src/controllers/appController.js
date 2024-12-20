const Product = require("../models/productModel");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const DatabaseClient = require("../config/db");
const redisClient = require("../utils/redisClient");

/**
 * App Controller to get stats and
 * status of the backend application
 */
class AppController {

    /**
     * Gets the Status of the application
     * @param {*} _request
     * @param {*} response
     * @returns
     */
  static getStatus = (_request, response) => {
    const redisHealth = redisClient.isReady();
    const dbHealth = DatabaseClient.isConnected;
    return response.status(200).send({
      message: "Server is Up",
      redisActive: redisHealth,
      dbActive: dbHealth,
    });
  };

  /**
     * Gets the Stats of the application (Products, Order, and Users)
     * @param {*} _request
     * @param {*} response
     * @returns
     */
  static getStats = async (_request, response) => {
    const totalNumberOfProducts = await Product.countDocuments();
    const totalNumberOfOrders = await Order.countDocuments();
    const totalNumberOfUsers = await User.countDocuments();

    return response
      .status(200)
      .send({ totalNumberOfUsers, totalNumberOfProducts, totalNumberOfOrders });
  };
}

module.exports = AppController;
