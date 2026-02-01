const mongoose = require("mongoose");

const StickyNoteSchema = new mongoose.Schema({
    resourceType: { type: String, enum: ["file", "folder"], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    creatorEmail: { type: String, required: true }, // Store for display
    content: { type: String, required: true, maxlength: 500 },
    color: { type: String, default: "yellow", enum: ["yellow", "blue", "green", "pink", "orange"] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Index for efficient lookup
StickyNoteSchema.index({ resourceId: 1, resourceType: 1 });

module.exports = mongoose.model("StickyNote", StickyNoteSchema);
