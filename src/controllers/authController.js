const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const {
  hashPassword,
  verifyPassword,
  generateToken,
  cacheToken,
  storeCookie,
} = require("../utils/userUtils");

/**
 * Handles User's Authentication
 */
class AuthController {
  static registerUser = asyncHandler(async (request, response) => {
    const { username, email, password } = request.body;

    if (!username || !email || !password)
      return response.status(400).send({
        success: false,
        message:
          "Incomplete Details. Either email, username or password is missing",
      });

    const userExists = await User.findOne({ email });

    if (userExists) {
      return response
        .status(400)
        .send({ message: "User with email already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    if (user) {
      // Cache user
      const token = generateToken(user._id);
      cacheToken(token, user);
      return response.status(201).send({
        success: true,
        message: "User created",
        result: {
          _id: user._id,
          username: user.username,
          email: user.email,
          token,
        },
      });
    } else {
      return response
        .status(400)
        .send({ success: false, message: "Invalid user data" });
    }
  });

  /**
   * Logs in in a user
   */
  static loginUser = asyncHandler(async (request, response) => {
    const { email, password } = request.body;

    if (!email || !password)
      return response.status(400).send({
        success: false,
        message: "Incomplete Details. Email or password is missing",
        result: "",
      });

    const user = await User.findOne({ email });

    if (user && (await verifyPassword(password, user.password))) {
      const token = generateToken(user._id);
      cacheToken(token, user);
      storeCookie(response, token);
      return response.status(201).send({
        success: true,
        message: "User logged in",
        result: {
          _id: user._id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin,
          token,
        },
      });
    } else {
      response
        .status(400)
        .send({ success: false, message: "Invalid user data", result: "" });
    }
  });

  static logoutUser = asyncHandler(async (request, response) => {
    const userId = request.user._id;
    const user = await User.findById(userId);

      user.token = null;
      await user.save();

      return response.status(200).send({
        success: true,
        message: "User logged out",
      });

  });

}

module.exports = AuthController;
