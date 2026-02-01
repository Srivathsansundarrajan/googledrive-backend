const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema({
    sharedDriveId: { type: mongoose.Schema.Types.ObjectId, ref: "SharedDrive", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userEmail: { type: String, required: true }, // Store for display without joins
    message: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now }
});

// Index for efficient chat retrieval
ChatMessageSchema.index({ sharedDriveId: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
