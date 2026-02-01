const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const notificationController = require("../controllers/notification.controller");

router.get("/", authMiddleware, notificationController.getNotifications);
router.put("/:id/read", authMiddleware, notificationController.markAsRead);
router.put("/read-all", authMiddleware, notificationController.markAllAsRead);
router.delete("/", authMiddleware, notificationController.clearNotifications);
router.delete("/:id", authMiddleware, notificationController.deleteNotification);

module.exports = router;
