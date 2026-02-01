const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const accessLogController = require("../controllers/accessLog.controller");

// Log access
router.post("/log", authMiddleware, accessLogController.logAccess);

// Get recently accessed
router.get("/recent", authMiddleware, accessLogController.getRecent);

// Get most frequently accessed
router.get("/frequent", authMiddleware, accessLogController.getFrequent);

module.exports = router;
