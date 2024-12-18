const Order = require("../models/orderModel");
const asyncHandler = require("express-async-handler");

const { getUserOrSessionId } = require("../utils/userUtils");
const redisClient = require("../utils/redisClient");
const { v4: uuidv4 } = require("uuid");

/**
 * Handles Order functionalities
 */
class OrderController {
  /**
   * Creates an order
   * @param {*} _request
   * @param {*} response
   * @returns
   */
  createOrder = asyncHandler(async (request, response) => {
    const userOrSessionId = getUserOrSessionId(request);
    const id = `order:${userOrSessionId}`;
    const { orderItems, totalPrice, paymentInfo } = request.body;
    const missingFields = [];
    if (!orderItems) missingFields.push("orderItems");
    if (!totalPrice) missingFields.push("totalPrice");
    if (!paymentInfo) missingFields.push("paymentInfo");
    if (missingFields.length > 0) {
      return response.status(400).send({
        success: false,
        message: `The following required fields are missing: ${missingFields.join(
          ", "
        )}`,
        result: "",
      });
    }
    try {
      const orderData = {
        orderItems,
        totalPrice,
        paymentInfo,
      };
      if (request.user) {
        //User is authenticated so we can stor his order in db
        orderData.user = request.user._id;
        const order = new Order(orderData);
        const createdOrder = await order.save();
        return response.status(201).send({
          success: true,
          message: "Order placed Successfully.",
          result: createdOrder,
        });
      } else {
        // User is not authenticated, store order in Redis
        const orderId = uuidv4();
        const id = `order:${userOrSessionId}`;
        const orderData = {
          orderItems,
          totalPrice,
          paymentInfo,
          sessionId: userOrSessionId,
          orderId,
        };
        redisClient.setValue(id, JSON.stringify(orderData), 72 * 3600);
        return response.status(201).send({
          success: true,
          message: `Order with OrderId ${orderId} placed successfully and cached. `,
          result: orderData,
        });
      }
    } catch (error) {
      console.log("Internal Server Error: ", error);
      return response.status(500).send({
        success: false,
        message: "An error Occurred",
        result: "",
      });
    }
  });

  /**
   * Gets an order by OrderId
   * @param {*} _request
   * @param {*} response
   * @returns
   */
  getOrderByOrderId = asyncHandler(async (request, response) => {
    const { orderId } = request.params;
    if (!orderId)
      return response.status(400).send({
        success: false,
        message: "Missing orderId",
        result: "",
      });
    const userOrSessionId = getUserOrSessionId(request);
    if (request.user) {
      // Authenicated user, get order from db
      const order = await Order.findById(orderId).populate(
        "user",
        "username email"
      );
      if (order && order.user._id.toString() === userOrSessionId) {
        return response.status(200).send({
          success: true,
          message: "Order retrieved successfully",
          result: order,
        });
      } else {
        return response.status(404).send({
          success: false,
          message: "Order not found",
          result: "",
        });
      }
    } else {
      // Unauthenticated user, get order from Redis
      const order = await redisClient.getValue(`order:${orderId}`);

      if (order) {
        order = JSON.parse(order);
        if (order.sessionId === userOrSessionId) {
          return response.status(200).send({
            success: true,
            message: "Order retrieved successfully",
            result: order,
          });
        } else {
          return response.status(404).send({
            success: false,
            message: "Order not found",
            result: "",
          });
        }
      } else {
        return response.status(404).send({
          success: false,
          message: "Order not found",
          result: "",
        });
      }
    }
  });

  /**
   * Get an order by User Id
   * @param {*} _request
   * @param {*} response
   * @returns
   */
  getOrderByUserId = asyncHandler(async (request, response) => {
    const orders = await Order.find({ user: request.user._id });
    if (orders.length > 0) {
      return response.status(200).send({
        success: true,
        message: "Order retrieved successfully",
        result: orders,
      });
    } else {
      return response.status(200).send({
        success: true,
        message: "No orders found",
        result: "",
      });
    }
  });

  /**
   * Retrieves all orders. Only accessible by an Admin user
   * @param {*} _request
   * @param {*} response
   * @returns
   */
  getAllOrders = asyncHandler(async (_request, response) => {
    const dbOrders = Order.find({}).populate("user", "username email");

    const redisKeys = await redisClient.getKeys("order:*");
    const redisOrders = await Promise.all(
      redisKeys.map(async (key) => {
        const order = await redisClient.getValue(key);
        return JSON.parse(order);
      })
    );
    const allOrders = [...dbOrders, ...redisOrders];
    if (dbOrders) {
      return response.status(200).send({
        success: true,
        message: "All orders retrieved successfully",
        result: allOrders,
      });
    } else {
      return response
        .status(200)
        .send({ success: true, message: "No orders yet", result: [] });
    }
  });
}

module.exports = new OrderController();
