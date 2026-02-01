const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  token: String,
  type: String, // activation | reset
  expiresAt: Date,
  used: { type: Boolean, default: false }
});

module.exports = mongoose.model("Token", tokenSchema);
