const File = require("../models/File");
const mongoose = require("mongoose");

// Get storage usage for user
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
                    _id: "$mimeType",
                    total: { $sum: "$size" },
                    count: { $sum: 1 }
                }
            }
        ]);

        let used = 0;
        let count = 0;
        const breakdown = {
            images: { size: 0, count: 0 },
            videos: { size: 0, count: 0 },
            audio: { size: 0, count: 0 },
            documents: { size: 0, count: 0 },
            others: { size: 0, count: 0 }
        };

        result.forEach(group => {
            used += group.total;
            count += group.count;
            const mime = (group._id || "").toLowerCase();

            if (mime.startsWith("image/")) {
                breakdown.images.size += group.total;
                breakdown.images.count += group.count;
            } else if (mime.startsWith("video/")) {
                breakdown.videos.size += group.total;
                breakdown.videos.count += group.count;
            } else if (mime.startsWith("audio/")) {
                breakdown.audio.size += group.total;
                breakdown.audio.count += group.count;
            } else if (mime.includes("pdf") || mime.includes("word") || mime.includes("excel") || mime.includes("sheet") || mime.includes("text")) {
                breakdown.documents.size += group.total;
                breakdown.documents.count += group.count;
            } else {
                breakdown.others.size += group.total;
                breakdown.others.count += group.count;
            }
        });

        const limit = 15 * 1024 * 1024 * 1024; // 15 GB in bytes

        res.json({
            used,
            limit,
            count,
            breakdown,
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
