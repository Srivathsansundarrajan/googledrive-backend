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

// Remove share
router.delete("/:id", authMiddleware, shareController.removeShare);

module.exports = router;
