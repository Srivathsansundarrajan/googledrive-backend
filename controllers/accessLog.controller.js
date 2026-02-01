const AccessLog = require("../models/AccessLog");
const mongoose = require("mongoose");

// Log a file/folder access
exports.logAccess = async (req, res) => {
    try {
        const { resourceType, resourceId, resourceName } = req.body;
        const userId = req.user.userId;

        if (!resourceType || !resourceId || !resourceName) {
            return res.status(400).json({ message: "resourceType, resourceId, and resourceName are required" });
        }

        await AccessLog.create({
            userId,
            resourceType,
            resourceId,
            resourceName
        });

        res.status(201).json({ message: "Access logged" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get recently accessed files/folders
exports.getRecent = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 20 } = req.query;

        // Get unique recent items
        const logs = await AccessLog.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $sort: { accessedAt: -1 } },
            {
                $group: {
                    _id: { resourceId: "$resourceId", resourceType: "$resourceType" },
                    resourceName: { $first: "$resourceName" },
                    resourceType: { $first: "$resourceType" },
                    resourceId: { $first: "$resourceId" },
                    lastAccessed: { $first: "$accessedAt" }
                }
            },
            { $sort: { lastAccessed: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({ items: logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get most frequently accessed files/folders
exports.getFrequent = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 20 } = req.query;

        const logs = await AccessLog.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: { resourceId: "$resourceId", resourceType: "$resourceType" },
                    resourceName: { $first: "$resourceName" },
                    resourceType: { $first: "$resourceType" },
                    resourceId: { $first: "$resourceId" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({ items: logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
