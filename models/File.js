const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  ownerId: mongoose.Schema.Types.ObjectId,
  fileName: String,
  s3Key: String,
  size: Number,
  mimeType: String,
  folderPath: {
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

module.exports = mongoose.model("File", fileSchema);
