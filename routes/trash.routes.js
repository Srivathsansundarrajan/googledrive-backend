const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const trashController = require("../controllers/trash.controller");

// List trash items
router.get("/", authMiddleware, trashController.listTrash);

// Restore item
router.post("/restore/:type/:id", authMiddleware, trashController.restore);

// Permanently delete item
router.delete("/:type/:id", authMiddleware, trashController.permanentDelete);

// Empty all trash
router.delete("/empty", authMiddleware, trashController.emptyTrash);

module.exports = router;
