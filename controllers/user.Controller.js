const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');

class UserController {
  // @desc    Get user profile
  // @route   GET /api/users/profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id)
        .select('-password')
        .populate('addresses');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (err) {
      console.error('Profile fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching user profile' });
    }
  }

  // @desc    Update user profile
  // @route   PUT /api/users/profile
  static async updateProfile(req, res) {
    try {
      const { name, email, phone, preferences } = req.body;

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if email is being changed and verify it's not taken
      if (email && email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          return res.status(400).json({ message: 'Email already in use' });
        }
        user.email = email;
      }

      // Update fields if provided
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (preferences) {
        user.preferences = {
          ...user.preferences,
          ...preferences
        };
      }

      await user.save();

      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;

      res.json(userResponse);
    } catch (err) {
      console.error('Profile update error:', err.message);
      res.status(500).json({ message: 'Error updating profile' });
    }
  }

  // @desc    Change password
  // @route   PUT /api/users/password
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

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
      res.status(500).json({ message: 'Error changing password' });
    }
  }

  // @desc    Add address
  // @route   POST /api/users/addresses
  static async addAddress(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.addresses.push(req.body);

      // Set as default if it's the first address or if specified
      if (user.addresses.length === 1 || req.body.isDefault) {
        user.addresses = user.addresses.map(addr => ({
          ...addr,
          isDefault: addr === req.body
        }));
      }

      await user.save();
      res.json(user.addresses);
    } catch (err) {
      console.error('Address addition error:', err.message);
      res.status(500).json({ message: 'Error adding address' });
    }
  }

  // @desc    Update address
  // @route   PUT /api/users/addresses/:addressId
  static async updateAddress(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === req.params.addressId
      );

      if (addressIndex === -1) {
        return res.status(404).json({ message: 'Address not found' });
      }

      user.addresses[addressIndex] = {
        ...user.addresses[addressIndex],
        ...req.body
      };

      // Handle default address changes
      if (req.body.isDefault) {
        user.addresses = user.addresses.map((addr, index) => ({
          ...addr,
          isDefault: index === addressIndex
        }));
      }

      await user.save();
      res.json(user.addresses);
    } catch (err) {
      console.error('Address update error:', err.message);
      res.status(500).json({ message: 'Error updating address' });
    }
  }

  // @desc    Delete address
  // @route   DELETE /api/users/addresses/:addressId
  static async deleteAddress(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === req.params.addressId
      );

      if (addressIndex === -1) {
        return res.status(404).json({ message: 'Address not found' });
      }

      // If deleting default address, make the first remaining address default
      const wasDefault = user.addresses[addressIndex].isDefault;
      user.addresses.splice(addressIndex, 1);

      if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
      }

      await user.save();
      res.json(user.addresses);
    } catch (err) {
      console.error('Address deletion error:', err.message);
      res.status(500).json({ message: 'Error deleting address' });
    }
  }

  // @desc    Update notification preferences
  // @route   PUT /api/users/notifications
  static async updateNotificationPreferences(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...req.body
      };

      await user.save();
      res.json(user.notificationPreferences);
    } catch (err) {
      console.error('Notification preferences update error:', err.message);
      res.status(500).json({ message: 'Error updating notification preferences' });
    }
  }

  // @desc    Get user activity log
  // @route   GET /api/users/activity
  static async getActivityLog(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const activities = user.activityLog
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(skip, skip + limit);

      res.json({
        activities,
        currentPage: page,
        totalPages: Math.ceil(user.activityLog.length / limit)
      });
    } catch (err) {
      console.error('Activity log fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching activity log' });
    }
  }

  // Admin Routes

  // @desc    Get all users (admin only)
  // @route   GET /api/users
  static async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search;

      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        };
      }

      const users = await User.find(query)
        .select('-password')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await User.countDocuments(query);

      res.json({
        users,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total
      });
    } catch (err) {
      console.error('Users fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching users' });
    }
  }

  // @desc    Get user by ID (admin only)
  // @route   GET /api/users/:id
  static async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id)
        .select('-password')
        .populate('addresses');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (err) {
      console.error('User fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching user' });
    }
  }

  // @desc    Update user role (admin only)
  // @route   PATCH /api/users/:id/role
  static async updateUserRole(req, res) {
    try {
      const { role } = req.body;
      const validRoles = ['user', 'admin', 'manager'];

      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (err) {
      console.error('Role update error:', err.message);
      res.status(500).json({ message: 'Error updating user role' });
    }
  }

  // @desc    Delete user (admin only)
  // @route   DELETE /api/users/:id
  static async deleteUser(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await user.remove();
      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      console.error('User deletion error:', err.message);
      res.status(500).json({ message: 'Error deleting user' });
    }
  }
}

module.exports = UserController;