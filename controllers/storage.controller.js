const File = require("../models/File");
const mongoose = require("mongoose");

// Get storage usage for user
exports.getStorageUsage = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Sum all file sizes for this user (excluding deleted files)
        const result = await File.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(userId),
                    isDeleted: { $ne: true }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$size" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const used = result.length > 0 ? result[0].total : 0;
        const count = result.length > 0 ? result[0].count : 0;
        const limit = 15 * 1024 * 1024 * 1024; // 15 GB in bytes

        res.json({
            used,
            limit,
            count,
            usedFormatted: formatBytes(used),
            limitFormatted: "15 GB"
        });
    } catch (err) {
        console.error("Storage usage error:", err);
        res.status(500).json({ error: err.message });
    }
};

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
