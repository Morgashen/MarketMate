const stripe = require("../config/stripe");
const asyncHandler = require("express-async-handler");
const Order = require("../models/orderModel");
const { v4: uuidv4 } = require("uuid");
const { getUserOrSessionId } = require("../utils/userUtils");
const redisClient = require("../utils/redisClient");

/**
 * Handles Payment functionalities
 */
class PaymentController {
  /**
   * Confirms payment and stores order to db
   * @param {*} _request
   * @param {*} response
   * @returns
   */
  pay = asyncHandler(async (request, response) => {
    try {
      const {
        amount,
        currency = "usd",
        paymentMethodId,
        shippingDetails,
        cart_
      } = request.body;
      console.log("Here", cart_)

      const userOrSessionId = getUserOrSessionId(request);
      const id = `order:${userOrSessionId}`;

      if (!amount || !paymentMethodId || !shippingDetails) {
        return response.status(400).send({
          success: false,
          message: "Amount, Payment ID, and Shipping Details are required",
          result: "",
        });
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency,
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      });

    //     let cart;
    // if (id) {

    //     cart = await redisClient.getValue(id);
    //     cart = JSON.parse(cart);
    // } else {
    //     cart = cart_;
    //     console.log(cart_);
    // }

      if (!cart_) {
        return response.status(404).send({
          success: false,
          message: "Cart is empty",
          result: "",
        });
      }

      const orderItems = Object.values(cart_).map((item) => ({
        name: item.name,
        product: item.product,
        image: `/uploads/${item.image.split('/').pop()}`,
        price: item.price,
        quantity: item.quantity,
      }));
    //   const totalPrice = cart_.cartItems.reduce(
    //     (acc, item) => acc + item.quantity * item.price,
    //     0
    //   );

      const shippingAddress = {
        address: shippingDetails.address,
        city: shippingDetails.city,
        postalCode: shippingDetails.postalCode,
        country: shippingDetails.country,
      };
      const orderData = {
        user: userOrSessionId,
        orderItems,
        shippingAddress,
        paymentMethod: "card",
        totalPrice: amount,
        isPaid: true,
        paidAt: Date.now(),
        paymentInfo: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
      };

      let createdOrder;
        console.log(request);
      if (request.user) {
        // Authenticated user, save order to db
        const order = new Order(orderData);
        createdOrder = await order.save();
        console.log('Created in db')
      } else {
        // Unauthenticated user, save order to Redis
        const orderId = `order:${uuidv4()}`;
        await redisClient.setValue(
          orderId,
          JSON.stringify(orderData),
          24 * 3600
        );
        createdOrder = orderData;
      }

      return response.status(201).send({
        success: true,
        message: "Order placed successfully",
        result: createdOrder,
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      return response.status(500).send({
        success: false,
        message: "Internal Server Error",
        result: "",
      });
    }
  });
}

module.exports = new PaymentController();
