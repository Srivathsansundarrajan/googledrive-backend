const ChatMessage = require("../models/ChatMessage");
const SharedDrive = require("../models/SharedDrive");

// Get chat messages for a shared drive
exports.getMessages = async (req, res) => {
    try {
        const { driveId } = req.params;
        const { limit = 50, before } = req.query;
        const userEmail = req.user.email;

        // Verify membership
        const sharedDrive = await SharedDrive.findById(driveId);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        const isMember = sharedDrive.members.some(m => m.email === userEmail);
        if (!isMember) {
            return res.status(403).json({ message: "Access denied" });
        }

        const query = { sharedDriveId: driveId };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({ messages: messages.reverse() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const notificationController = require("../controllers/notification.controller");
const socket = require("../socket");

// ... (existing code)

// Send a chat message
exports.sendMessage = async (req, res) => {
    try {
        const { driveId } = req.params;
        const { message } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        if (!message || !message.trim()) {
            return res.status(400).json({ message: "Message content is required" });
        }

        // Verify membership
        const sharedDrive = await SharedDrive.findById(driveId);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        const isMember = sharedDrive.members.some(m => m.email === userEmail);
        if (!isMember) {
            return res.status(403).json({ message: "Access denied" });
        }

        const chatMessage = await ChatMessage.create({
            sharedDriveId: driveId,
            userId,
            userEmail,
            message: message.trim()
        });

        // Emit real-time message to the room
        try {
            const io = socket.getIO();
            io.to(driveId).emit("receive_message", {
                _id: chatMessage._id,
                userEmail: chatMessage.userEmail,
                message: chatMessage.message,
                createdAt: chatMessage.createdAt
            });
        } catch (err) {
            console.error("Socket emit error:", err);
        }

        // Notify other members (Persistent notification)
        const otherMembers = sharedDrive.members.filter(m => m.email !== userEmail);
        for (const member of otherMembers) {
            if (member.userId) {
                await notificationController.createNotification(
                    member.userId,
                    "chat",
                    `New message in ${sharedDrive.name}`,
                    `${userEmail.split("@")[0]}: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
                    `/shared-drives/${driveId}`
                );
            }
        }

        res.status(201).json({ message: "Message sent", chatMessage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete a message (only by sender)
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.userId;

        const message = await ChatMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.userId.toString() !== userId) {
            return res.status(403).json({ message: "You can only delete your own messages" });
        }

        await ChatMessage.findByIdAndDelete(messageId);
        res.json({ message: "Message deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
