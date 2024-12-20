const asyncHandler = require("express-async-handler");

const { getUserOrSessionId } = require("../utils/userUtils");
const redisClient = require("../utils/redisClient");
const Product = require("../models/productModel");

/**
 * Handles Cart Functionalities
 */
class CartController {
  /**
   * Adds a product to cart
   */
  addToCart = asyncHandler(async (request, response) => {
    try {
    console.log(request.headers)
      const userOrSessionId = getUserOrSessionId(request);
      const id = `cart:${userOrSessionId}`;
      const { product, quantity } = request.body;
      if (!product || !quantity)
        return response.status(400).send({
          success: false,
          message: "Missing product or quantity",
          result: "",
        });

      let cart = await redisClient.getValue(id);
      let updatedCart;

      if (cart) {
        cart = JSON.parse(cart);
        const itemIndex = cart.cartItems.findIndex(
          (item) => item.product.toString() == product
        );

        if (itemIndex > -1) {
          cart.cartItems[itemIndex].quantity += quantity;
        } else {
          cart.cartItems.push({ product, quantity });
        }

        updatedCart = cart;
      } else {

          const product_ = await Product.findOne({ sku: product });
        updatedCart = {
          user: id,
          cartItems: [
            {
              product,
              quantity,
              name: product_.name,
              price: product_.price,
              image: product_.images[0],
            },
          ],
        };
      }

      redisClient.setValue(id, JSON.stringify(updatedCart), 24 * 3600);

      return response.status(200).send({
        success: true,
        message: "Product added to cart successfully",
        result: updatedCart,
      });
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
   * Retrieves a product from cart
   */
  getCart = asyncHandler(async (request, response) => {
    const userOrSessionId = getUserOrSessionId(request);
    const id = `cart:${userOrSessionId}`;
    const cart = await redisClient.getValue(id);

    if (cart) {
      return response.status(200).send({
        success: true,
        message: "Cart retrieved successfully",
        result: JSON.parse(cart),
      });
    } else {
      return response.status(200).send({
        success: true,
        message: "Cart is empty",
        result: "",
      });
    }
  });

  /**
   * Removes a product from cart
  */
  removeFromCart = asyncHandler(async (request, response) => {
    const userOrSessionId = getUserOrSessionId(request);
    const id = `cart:${userOrSessionId}`;
    const { sku } = request.params;
    if (!sku)
      return response.status(400).send({
        success: false,
        message: "Product SKU is missing",
        result: "",
      });

    let cart = await redisClient.getValue(id);

    if (cart) {
      cart = JSON.parse(cart);
      cart.cartItems = cart.cartItems.filter(
        (item) => item.product.toString() !== sku
      );
      redisClient.setValue(id, JSON.stringify(cart), 24 * 3600);
      return response.status(200).send({
        success: true,
        message: "Product removed from cart",
        result: cart,
      });
    } else {
      return response.status(404).send({
        success: true,
        message: "Cart is empty",
        result: "",
      });
    }
  });

  deleteCart = asyncHandler(async (request, response) => {
    const userOrSessionId = getUserOrSessionId(request);
    const id = `cart:${userOrSessionId}`;
    let cart = await redisClient.getValue(id);

    if (!cart) {
        return response.status(200).send({
            success: true,
            message: "Cart id empty",
            result: "",
          });
    }else {
        redisClient.deleteValue(id);
        return response.status(200).send({
            success: true,
            message: "Cart has been reset",
            result: "",
          });
        }

    })
}

module.exports = new CartController();
