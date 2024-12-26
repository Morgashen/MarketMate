const User = require('../models/User');
const jwt = require('jsonwebtoken');

// This controller handles all authentication-related business logic
class AuthController {
  // Register a new user
  static async register(userData) {
    // First check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('A MarketMate account with this email already exists');
    }

    // Create new user
    const user = new User({
      email: userData.email,
      password: userData.password, // Will be hashed by the User model
      name: userData.name
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;

    return { token, user: userResponse };
  }

  // Login existing user
  static async login(credentials) {
    // Find user by email
    const user = await User.findOne({ email: credentials.email });
    if (!user) {
      throw new Error('Invalid MarketMate credentials');
    }

    // Verify password
    const isValidPassword = await user.comparePassword(credentials.password);
    if (!isValidPassword) {
      throw new Error('Invalid MarketMate credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;

    return { token, user: userResponse };
  }

  // Get user profile
  static async getProfile(userId) {
    const user = await User.findById(userId)
      .select('-password')
      .populate('orders');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

// Export the controller for use in routes
module.exports = AuthController;