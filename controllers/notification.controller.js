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

const socket = require("../socket");

// Internal helper to create notification
exports.createNotification = async (recipientId, type, title, message, link = null) => {
    try {
        const newNotification = await Notification.create({
            recipientId,
            type,
            title,
            message,
            link
        });

        // Emit socket event
        try {
            const io = socket.getIO();
            const socketId = socket.getUserSocketId(recipientId.toString());
            if (socketId) {
                io.to(socketId).emit("new_notification", newNotification);
            }
        } catch (err) {
            console.error("Socket emit error:", err);
        }

    } catch (err) {
        console.error("Failed to create notification:", err);
    }
    // Added return to ensure promise resolves correctly if awaited
    return;
};

// Internal helper to create multiple notifications (batch)
exports.createManyNotifications = async (notificationsArray) => {
    try {
        if (!notificationsArray || notificationsArray.length === 0) return;

        const createdNotifications = await Notification.insertMany(notificationsArray);

        // Emit socket events asynchronously
        try {
            const io = socket.getIO();
            createdNotifications.forEach(notification => {
                const socketId = socket.getUserSocketId(notification.recipientId.toString());
                if (socketId) {
                    io.to(socketId).emit("new_notification", notification);
                }
            });
        } catch (err) {
            console.error("Socket emit error:", err);
        }

        return createdNotifications;
    } catch (err) {
        console.error("Failed to create notifications batch:", err);
    }
};

