const Share = require("../models/Share");
const File = require("../models/File");
const Folder = require("../models/Folder");
const crypto = require("crypto");
const emailService = require("../services/email.service");

// Share a file or folder
exports.shareResource = async (req, res) => {
    try {
        const { resourceType, resourceId, email, permission = "download" } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        if (!resourceType || !resourceId || !email) {
            return res.status(400).json({ message: "resourceType, resourceId, and email are required" });
        }

        // Verify ownership
        const Model = resourceType === "file" ? File : Folder;
        const resource = await Model.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ message: "Resource not found" });
        }

        if (resource.ownerId.toString() !== userId) {
            return res.status(403).json({ message: "You can only share your own files" });
        }

        // Generate access token
        const accessToken = crypto.randomBytes(32).toString("hex");

        const share = await Share.create({
            resourceType,
            resourceId,
            sharedBy: userId,
            sharedWith: email,
            accessToken,
            permission
        });

        const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
        const shareLink = `${frontendUrl}/shared/${accessToken}`;
        const resourceName = resource.fileName || resource.name;

        // Send email notification
        emailService.sendShareNotification(email, userEmail, resourceName, resourceType, shareLink);

        res.status(201).json({
            message: "Shared successfully",
            share,
            shareLink
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get items shared with me
exports.getSharedWithMe = async (req, res) => {
    try {
        const userEmail = req.user.email;

        const shares = await Share.find({ sharedWith: userEmail })
            .sort({ createdAt: -1 });

        // Get resource details
        const items = await Promise.all(shares.map(async (share) => {
            const Model = share.resourceType === "file" ? File : Folder;
            const resource = await Model.findById(share.resourceId);
            return {
                ...share.toObject(),
                resource
            };
        }));

        res.json({ items: items.filter(i => i.resource) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Access shared resource by token
exports.accessByToken = async (req, res) => {
    try {
        const { token } = req.params;

        const share = await Share.findOne({ accessToken: token });
        if (!share) {
            return res.status(404).json({ message: "Share link not found or expired" });
        }

        // Check expiration
        if (share.expiresAt && new Date() > share.expiresAt) {
            return res.status(410).json({ message: "Share link has expired" });
        }

        const Model = share.resourceType === "file" ? File : Folder;
        const resource = await Model.findById(share.resourceId);

        if (!resource) {
            return res.status(404).json({ message: "Resource no longer exists" });
        }

        let previewUrl = null;
        if (share.resourceType === "file") {
            // Generate S3 Signed URL for access
            // Enforce basic access: If you have the token, you can VIEW.
            previewUrl = require("../services/s3.service").getSignedUrl("getObject", {
                Bucket: process.env.AWS_S3_BUCKET,
                Key: resource.s3Key,
                Expires: 300 // 5 minutes
            });
        }

        res.json({ share, resource, previewUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Remove share
exports.removeShare = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const share = await Share.findById(id);
        if (!share) {
            return res.status(404).json({ message: "Share not found" });
        }

        if (share.sharedBy.toString() !== userId) {
            return res.status(403).json({ message: "Access denied" });
        }

        await Share.findByIdAndDelete(id);
        res.json({ message: "Share removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
