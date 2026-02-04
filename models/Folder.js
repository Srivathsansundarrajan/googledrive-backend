const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema({
  name: String,
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  parentPath: {
    type: String,
    default: "/"
  },
  sharedDriveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SharedDrive",
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isStarred: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Indexes for performance
folderSchema.index({ ownerId: 1, parentPath: 1 });
folderSchema.index({ ownerId: 1, isDeleted: 1 });
folderSchema.index({ ownerId: 1, isStarred: 1 });

module.exports = mongoose.model("Folder", folderSchema);
