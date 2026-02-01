const mongoose = require("mongoose");

const AccessLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resourceType: { type: String, enum: ["file", "folder"], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    resourceName: { type: String, required: true }, // Store name for quick display
    accessedAt: { type: Date, default: Date.now }
});

// Index for efficient queries by user and date
AccessLogSchema.index({ userId: 1, accessedAt: -1 });
AccessLogSchema.index({ userId: 1, resourceId: 1 });

module.exports = mongoose.model("AccessLog", AccessLogSchema);
