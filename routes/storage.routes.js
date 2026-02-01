const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const storageController = require("../controllers/storage.controller");

// Get storage usage
router.get("/", authMiddleware, storageController.getStorageUsage);

module.exports = router;
