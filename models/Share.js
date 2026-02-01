const mongoose = require("mongoose");

const ShareSchema = new mongoose.Schema({
    resourceType: { type: String, enum: ["file", "folder"], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sharedWith: { type: String, required: true }, // email address
    accessToken: { type: String, unique: true }, // for link-based access
    permission: { type: String, enum: ["view", "download", "edit"], default: "download" },
    expiresAt: { type: Date }, // optional expiration
    createdAt: { type: Date, default: Date.now }
});

// Index for efficient lookups
ShareSchema.index({ sharedWith: 1 });
ShareSchema.index({ resourceId: 1, resourceType: 1 });

module.exports = mongoose.model("Share", ShareSchema);
