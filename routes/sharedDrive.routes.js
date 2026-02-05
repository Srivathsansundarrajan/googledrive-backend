const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const sharedDriveController = require("../controllers/sharedDrive.controller");

// Create shared drive
router.post("/", authMiddleware, sharedDriveController.createSharedDrive);

// List all shared drives for user
router.get("/", authMiddleware, sharedDriveController.listSharedDrives);

// Get shared drive details
router.get("/:id", authMiddleware, sharedDriveController.getSharedDrive);

// Get shared drive contents
router.get("/:id/contents", authMiddleware, sharedDriveController.getSharedDriveContents);

// Add member
router.post("/:id/members", authMiddleware, sharedDriveController.addMember);

// Remove member
router.delete("/:id/members/:memberEmail", authMiddleware, sharedDriveController.removeMember);

// Delete shared drive
router.delete("/:id", authMiddleware, sharedDriveController.deleteSharedDrive);

// Create folder in shared drive
router.post("/:id/folders", authMiddleware, sharedDriveController.createFolderInDrive);

// Move file/folder to shared drive
router.post("/:id/move", authMiddleware, sharedDriveController.moveToSharedDrive);

// Upload file to shared drive
const { upload } = require("../middleware/upload.middleware");
router.post("/:id/upload", authMiddleware, upload.single("file"), sharedDriveController.uploadToSharedDrive);

// Download folder in shared drive
router.get("/:id/folders/:folderId/download", authMiddleware, sharedDriveController.downloadFolderInDrive);

// Delete item (file/folder) in shared drive
router.delete("/:id/items/:type/:itemId", authMiddleware, sharedDriveController.deleteItemInDrive);

module.exports = router;
