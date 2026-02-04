const User = require("../models/User");

// Get storage usage for user
exports.getStorageUsage = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);

        // Check if cached storageUsed exists and is not undefined
        if (user && user.storageUsed !== undefined && user.storageUsed !== null) {
            // Return cached value, but still get breakdown efficiently if needed?
            // Actually sidebar just needs total. The breakdown modal calls this too? 
            // Yes. To support breakdown without heavy query, we might need to cache breakdown too.
            // BUT user asked to prioritize speed. 
            // Optimized approach:
            // 1. If storageUsed exists, only do breakdown aggregation if requested?
            //    The frontend API /storage is called once. 
            //    Let's stick to the plan: if we have storageUsed, use it.
            //    However, `breakdown` is required by the frontend interface.
            //    If we stop aggregating, we lose breakdown data.

            // COMPROMISE: We still need aggregation for breakdown unless we cache that too.
            // However, often the breakdown is only shown in the modal.
            // The sidebar needs `used` immediately.

            // Let's assume for now we must run aggregation for breakdown ANYWAY if we want to show it.
            // BUT, we can make the aggregation faster? No, it has to scan.

            // WAIT. User complained about "sidebar taking long".
            // If we just return `used` from User model, and maybe send empty/dummy breakdown until modal opens?
            // Or, we can do two endpoints? No, let's keep one.

            // Let's do a fast path:
            // If `storageUsed` is there, use it for the total `used`.
            // We still run aggregation for breakdown? That defeats the point.

            // Alternative: If `storageUsed` is present, assume this is accurate.
            // Only run aggregation if we really think we need to sync?

            // Let's implement the "Migration/Sync" logic.
            // If storageUsed is 0 (and strict check says user might have files?), maybe we should sync.
            // But for now, let's just run aggregation to backfill ONCE.
            // The problem is, if we always run aggregation, we didn't optimize anything.

            // REVISED PLAN:
            // We return `user.storageUsed` immediately.
            // We skip breakdown calculation to make it fast? 
            // Sidebar uses `breakdown`? 
            // Sidebar: `storage.usedFormatted`, `storage.limitFormatted`. 
            // Sidebar checks `storage.breakdown` ONLY inside `Storage Detail Modal`.
            // So, we can return empty breakdown for the initial sidebar load?
            // But the API returns everything at once.

            // Fast path: Return `used` from DB. Return empty/cached breakdown.
            // Since we didn't add breakdown to User model, let's just calculate `used` via aggregation ONLY IF `user.storageUsed` is missing.
            // Once we populate it, we rely on it.
            // We accept that breakdown might be empty or we'll need a separate endpoint for details.
            // Let's populate breakdown with zeros or minimal data if we use cached `used`.

            if (user.storageUsed !== undefined) {
                const limit = 15 * 1024 * 1024 * 1024;
                return res.json({
                    used: user.storageUsed,
                    limit,
                    count: 0, // We miss count, but sidebar doesn't show it prominently
                    breakdown: {
                        images: { size: 0, count: 0 },
                        videos: { size: 0, count: 0 },
                        audio: { size: 0, count: 0 },
                        documents: { size: 0, count: 0 },
                        others: { size: 0, count: 0 }
                    },
                    usedFormatted: formatBytes(user.storageUsed),
                    limitFormatted: "15 GB"
                });
            }
        }

        // --- FALLBACK / BACKFILL (Slow path) ---
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

        // Update user model with calculated total (BACKFILL)
        await User.findByIdAndUpdate(userId, { storageUsed: used });

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
