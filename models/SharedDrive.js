const mongoose = require("mongoose");

const SharedDriveSchema = new mongoose.Schema({
    name: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        email: { type: String, required: true },
        role: { type: String, enum: ["admin", "editor", "viewer"], default: "editor" },
        joinedAt: { type: Date, default: Date.now }
    }],
    description: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SharedDrive", SharedDriveSchema);
