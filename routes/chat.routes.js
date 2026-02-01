const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const chatController = require("../controllers/chat.controller");

// Get messages for a shared drive
router.get("/drive/:driveId", authMiddleware, chatController.getMessages);

// Send a message
router.post("/drive/:driveId", authMiddleware, chatController.sendMessage);

// Delete a message
router.delete("/:messageId", authMiddleware, chatController.deleteMessage);

module.exports = router;
