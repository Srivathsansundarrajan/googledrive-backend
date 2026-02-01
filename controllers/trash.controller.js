const File = require("../models/File");
const Folder = require("../models/Folder");
const s3 = require("../services/s3.service");

// List trash items for user
exports.listTrash = async (req, res) => {
    try {
        const userId = req.user.userId;
        const now = new Date();

        // Get deleted files
        const files = await File.find({
            ownerId: userId,
            isDeleted: true
        }).sort({ deletedAt: -1 });

        // Get deleted folders
        const folders = await Folder.find({
            ownerId: userId,
            isDeleted: true
        }).sort({ deletedAt: -1 });

        // Combine and calculate days remaining
        const items = [
            ...files.map(f => ({
                _id: f._id,
                type: "file",
                name: f.fileName,
                size: f.size,
                deletedAt: f.deletedAt,
                daysRemaining: Math.max(0, 30 - Math.floor((now - f.deletedAt) / (1000 * 60 * 60 * 24)))
            })),
            ...folders.map(f => ({
                _id: f._id,
                type: "folder",
                name: f.name,
                deletedAt: f.deletedAt,
                daysRemaining: Math.max(0, 30 - Math.floor((now - f.deletedAt) / (1000 * 60 * 60 * 24)))
            }))
        ];

        // Sort by deletedAt
        items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

        res.json({ items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Restore from trash
exports.restore = async (req, res) => {
    try {
        const { type, id } = req.params;
        const userId = req.user.userId;

        const Model = type === "file" ? File : Folder;
        const item = await Model.findById(id);

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        if (item.ownerId?.toString() !== userId) {
            return res.status(403).json({ message: "Access denied" });
        }

        item.isDeleted = false;
        item.deletedAt = null;
        await item.save();

        res.json({ message: "Item restored", item });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Permanently delete
exports.permanentDelete = async (req, res) => {
    try {
        const { type, id } = req.params;
        const userId = req.user.userId;

        const Model = type === "file" ? File : Folder;
        const item = await Model.findById(id);

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        if (item.ownerId?.toString() !== userId) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Delete from S3 if file
        if (type === "file" && item.s3Key) {
            try {
                await s3.deleteObject({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: item.s3Key
                }).promise();
            } catch (s3Err) {
                console.error("S3 delete error:", s3Err.message);
            }
        }

        await Model.findByIdAndDelete(id);
        res.json({ message: "Item permanently deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Empty all trash
exports.emptyTrash = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get all deleted files to delete from S3
        const files = await File.find({ ownerId: userId, isDeleted: true });

        for (const file of files) {
            if (file.s3Key) {
                try {
                    await s3.deleteObject({
                        Bucket: process.env.AWS_S3_BUCKET,
                        Key: file.s3Key
                    }).promise();
                } catch (s3Err) {
                    console.error("S3 delete error:", s3Err.message);
                }
            }
        }

        // Delete from database
        await File.deleteMany({ ownerId: userId, isDeleted: true });
        await Folder.deleteMany({ ownerId: userId, isDeleted: true });

        res.json({ message: "Trash emptied" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Auto-cleanup (called by cron or manually)
exports.autoCleanup = async () => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);

        // Find files older than 30 days in trash
        const oldFiles = await File.find({
            isDeleted: true,
            deletedAt: { $lt: cutoffDate }
        });

        for (const file of oldFiles) {
            if (file.s3Key) {
                try {
                    await s3.deleteObject({
                        Bucket: process.env.AWS_S3_BUCKET,
                        Key: file.s3Key
                    }).promise();
                } catch (s3Err) {
                    console.error("S3 auto-delete error:", s3Err.message);
                }
            }
            await File.findByIdAndDelete(file._id);
        }

        // Delete old folders
        await Folder.deleteMany({
            isDeleted: true,
            deletedAt: { $lt: cutoffDate }
        });

        console.log(`[Trash Cleanup] Deleted ${oldFiles.length} files`);
    } catch (err) {
        console.error("[Trash Cleanup] Error:", err.message);
    }
};
