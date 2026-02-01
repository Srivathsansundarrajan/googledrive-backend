const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user.userId })
            .sort({ createdAt: -1 }) // Newest first
            .limit(50); // Limit to last 50

        res.json({ notifications });
    } catch (err) {
        console.error("Get notifications error:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndUpdate(id, { read: true });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark read error:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientId: req.user.userId, read: false },
            { read: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Mark all read error:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.clearNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ recipientId: req.user.userId });
        res.json({ success: true });
    } catch (err) {
        console.error("Clear notifications error:", err);
        res.status(500).json({ error: err.message });
    }
};

// Delete single notification
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        if (notification.recipientId.toString() !== req.user.userId) {
            return res.status(403).json({ error: "Access denied" });
        }

        await Notification.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete notification error:", err);
        res.status(500).json({ error: err.message });
    }
};

// Internal helper to create notification
exports.createNotification = async (recipientId, type, title, message, link = null) => {
    try {
        await Notification.create({
            recipientId,
            type,
            title,
            message,
            link
        });
    } catch (err) {
        console.error("Failed to create notification:", err);
    }
};
