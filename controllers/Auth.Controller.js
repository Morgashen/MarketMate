const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const User = require('../models/User');

class AuthController {
  // @desc    Register a new user
  // @route   POST /api/auth/register
  static async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create new user
      user = new User({
        name,
        email,
        password
      });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      await user.save();

      // Create and return JWT token
      const payload = {
        user: {
          id: user.id
        }
      };

      const token = jwt.sign(payload, config.get('jwtSecret'), {
        expiresIn: '24h'
      });

      res.json({ token });
    } catch (err) {
      console.error('Registration error:', err.message);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }

  // @desc    Authenticate user & get token
  // @route   POST /api/auth/login
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Validate password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Create and return JWT token
      const payload = {
        user: {
          id: user.id
        }
      };

      const token = jwt.sign(payload, config.get('jwtSecret'), {
        expiresIn: '24h'
      });

      res.json({ token });
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ message: 'Server error during login' });
    }
  }

  // @desc    Get user profile
  // @route   GET /api/auth/user
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      console.error('Profile fetch error:', err.message);
      res.status(500).json({ message: 'Server error fetching profile' });
    }
  }

  // @desc    Update user profile
  // @route   PUT /api/auth/user
  static async updateProfile(req, res) {
    try {
      const { name, email } = req.body;
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update fields if provided
      if (name) user.name = name;
      if (email) user.email = email;

      await user.save();
      res.json(user);
    } catch (err) {
      console.error('Profile update error:', err.message);
      res.status(500).json({ message: 'Server error updating profile' });
    }
  }

  // @desc    Change password
  // @route   PUT /api/auth/password
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user.id);

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);

      await user.save();
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('Password change error:', err.message);
      res.status(500).json({ message: 'Server error changing password' });
    }
  }
}

module.exports = AuthController;