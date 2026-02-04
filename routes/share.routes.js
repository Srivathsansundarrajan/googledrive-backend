const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const shareController = require("../controllers/share.controller");

// Share a resource
router.post("/", authMiddleware, shareController.shareResource);

// Get items shared with me
router.get("/with-me", authMiddleware, shareController.getSharedWithMe);

// Access by token (public)
router.get("/access/:token", shareController.accessByToken);

// Get shared folder contents (public access with token)
router.get("/folder/:token", shareController.getSharedFolderContents);

// Download shared item (File or Folder) - Public with token
router.get("/download/:token", shareController.downloadSharedItem);

// Remove share (revoke or leave)
router.delete("/:id", authMiddleware, shareController.removeShare);

// Get all shares for a resource (Manage Access)
router.get("/resource/:resourceId", authMiddleware, shareController.getResourceShares);

// Update share permission
router.put("/:id", authMiddleware, shareController.updateSharePermission);

module.exports = router;
