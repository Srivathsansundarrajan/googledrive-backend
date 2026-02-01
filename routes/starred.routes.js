const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const starredController = require("../controllers/starred.controller");

// Toggle starred status
router.put("/:type/:id", authMiddleware, starredController.toggleStarred);

// Get all starred items
router.get("/", authMiddleware, starredController.getStarred);

module.exports = router;
