const mongoose = require('mongoose');

// User schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },  // Ensure email is unique
  password: { type: String, required: true }
});

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;