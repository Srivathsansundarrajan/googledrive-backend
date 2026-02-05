const SharedDrive = require("../models/SharedDrive");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");

// Create a new shared drive
exports.createSharedDrive = async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        if (!name) {
            return res.status(400).json({ message: "Shared drive name is required" });
        }

        const sharedDrive = await SharedDrive.create({
            name,
            description: description || "",
            ownerId: userId,
            members: [{
                userId,
                email: userEmail,
                role: "admin"
            }]
        });

        res.status(201).json({
            message: "Shared drive created",
            sharedDrive
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// List all shared drives for user
exports.listSharedDrives = async (req, res) => {
    try {
        const userEmail = req.user.email;

        const sharedDrives = await SharedDrive.find({
            "members.email": userEmail
        }).sort({ createdAt: -1 });

        res.json({ sharedDrives });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get shared drive details
exports.getSharedDrive = async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.user.email;

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        // Check if user is a member
        const isMember = sharedDrive.members.some(m => m.email === userEmail);
        if (!isMember) {
            return res.status(403).json({ message: "Access denied" });
        }

        res.json({ sharedDrive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get shared drive contents (files and folders)
exports.getSharedDriveContents = async (req, res) => {
    try {
        const { id } = req.params;
        const { path = "/" } = req.query;
        const userEmail = req.user.email;

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        const isMember = sharedDrive.members.some(m => m.email === userEmail);
        if (!isMember) {
            return res.status(403).json({ message: "Access denied" });
        }

        const folders = await Folder.find({
            sharedDriveId: id,
            parentPath: path
        }).sort({ name: 1 });

        const files = await File.find({
            sharedDriveId: id,
            folderPath: path
        }).sort({ fileName: 1 });

        res.json({ folders, files, sharedDrive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add member to shared drive
exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, role = "editor" } = req.body;
        const userEmail = req.user.email;

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        // Check if current user is admin
        const currentMember = sharedDrive.members.find(m => m.email === userEmail);
        if (!currentMember || currentMember.role !== "admin") {
            return res.status(403).json({ message: "Only admins can add members" });
        }

        // Check if already a member
        const existingMember = sharedDrive.members.find(m => m.email === email);
        if (existingMember) {
            return res.status(400).json({ message: "User is already a member" });
        }

        // Find user by email to get userId (if they exist)
        const user = await User.findOne({ email });

        sharedDrive.members.push({
            userId: user ? user._id : null,
            email,
            role
        });

        await sharedDrive.save();

        // Send email invitation
        try {
            const emailService = require("../services/email.service");
            console.log("[Email] Sending drive invitation to:", email);
            await emailService.sendDriveInvitation(email, userEmail, sharedDrive.name, role);
            console.log("[Email] Drive invitation sent successfully to:", email);
        } catch (emailErr) {
            console.error("[Email] Failed to send drive invitation:", emailErr.message);
            // Don't fail the whole request if email fails
        }

        // Send in-app notification to the new member
        if (user) {
            const notificationController = require("./notification.controller");
            await notificationController.createNotification(
                user._id,
                "share",
                `Added to ${sharedDrive.name}`,
                `${userEmail.split("@")[0]} added you to the shared drive "${sharedDrive.name}" as ${role}`,
                `/shared-drives/${id}`
            );
        }

        res.json({ message: "Member added successfully", sharedDrive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Remove member from shared drive
exports.removeMember = async (req, res) => {
    try {
        const { id, memberEmail } = req.params;
        const userEmail = req.user.email;

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        // Check if current user is admin
        const currentMember = sharedDrive.members.find(m => m.email === userEmail);
        if (!currentMember || currentMember.role !== "admin") {
            return res.status(403).json({ message: "Only admins can remove members" });
        }

        // Can't remove owner
        if (sharedDrive.ownerId.toString() === memberEmail) {
            return res.status(400).json({ message: "Cannot remove the owner" });
        }

        sharedDrive.members = sharedDrive.members.filter(m => m.email !== memberEmail);
        await sharedDrive.save();

        res.json({ message: "Member removed", sharedDrive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete shared drive
exports.deleteSharedDrive = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        if (sharedDrive.ownerId.toString() !== userId) {
            return res.status(403).json({ message: "Only the owner can delete the shared drive" });
        }

        // Delete all files and folders in the shared drive
        await File.deleteMany({ sharedDriveId: id });
        await Folder.deleteMany({ sharedDriveId: id });
        await SharedDrive.findByIdAndDelete(id);

        res.json({ message: "Shared drive deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create folder in shared drive
exports.createFolderInDrive = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parentPath = "/" } = req.body;
        const userEmail = req.user.email;

        if (!name) {
            return res.status(400).json({ message: "Folder name is required" });
        }

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        // Check membership and permissions
        const member = sharedDrive.members.find(m => m.email === userEmail);
        if (!member) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (member.role === "viewer") {
            return res.status(403).json({ message: "Viewers cannot create folders" });
        }

        // Check if folder already exists
        const existing = await Folder.findOne({
            sharedDriveId: id,
            parentPath,
            name
        });
        if (existing) {
            return res.status(409).json({ message: "Folder already exists" });
        }

        const folder = await Folder.create({
            name,
            parentPath,
            sharedDriveId: id,
            ownerId: null // Shared drive folders don't have individual owners
        });

        res.status(201).json({ message: "Folder created", folder });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Move file/folder to shared drive
exports.moveToSharedDrive = async (req, res) => {
    try {
        const { id } = req.params;
        const { resourceType, resourceId, targetPath = "/" } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        if (!resourceType || !resourceId) {
            return res.status(400).json({ message: "resourceType and resourceId are required" });
        }

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        // Check membership and permissions
        const member = sharedDrive.members.find(m => m.email === userEmail);
        if (!member) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (member.role === "viewer") {
            return res.status(403).json({ message: "Viewers cannot move files" });
        }

        if (resourceType === "file") {
            const file = await File.findById(resourceId);
            if (!file) {
                return res.status(404).json({ message: "File not found" });
            }
            // Verify ownership
            if (file.ownerId && file.ownerId.toString() !== userId) {
                return res.status(403).json({ message: "You can only move your own files" });
            }

            file.sharedDriveId = id;
            file.folderPath = targetPath;
            file.ownerId = null; // Remove personal ownership
            await file.save();

            res.json({ message: "File moved to shared drive", file });
        } else if (resourceType === "folder") {
            const folder = await Folder.findById(resourceId);
            if (!folder) {
                return res.status(404).json({ message: "Folder not found" });
            }
            // Verify ownership
            if (folder.ownerId && folder.ownerId.toString() !== userId) {
                return res.status(403).json({ message: "You can only move your own folders" });
            }

            folder.sharedDriveId = id;
            folder.parentPath = targetPath;
            folder.ownerId = null;
            await folder.save();

            res.json({ message: "Folder moved to shared drive", folder });
        } else {
            return res.status(400).json({ message: "Invalid resourceType" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Upload file to shared drive
const s3 = require("../services/s3.service");

exports.uploadToSharedDrive = async (req, res) => {
    try {
        const { id } = req.params;
        const file = req.file;
        const folderPath = req.body.path || "/";
        const userEmail = req.user.email;

        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        // Check membership and permissions
        const member = sharedDrive.members.find(m => m.email === userEmail);
        if (!member) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (member.role === "viewer") {
            return res.status(403).json({ message: "Viewers cannot upload files" });
        }

        // Auto-create parent folders for the entire path
        if (folderPath !== "/") {
            const pathParts = folderPath.split("/").filter(Boolean);
            let currentParentPath = "/";

            // Create each folder in the path if it doesn't exist
            for (let i = 0; i < pathParts.length; i++) {
                const folderName = pathParts[i];

                await Folder.findOneAndUpdate(
                    { sharedDriveId: id, name: folderName, parentPath: currentParentPath },
                    { sharedDriveId: id, name: folderName, parentPath: currentParentPath, ownerId: null },
                    { upsert: true, new: true }
                );

                // Update parent path for next folder
                currentParentPath = currentParentPath === "/"
                    ? `/${folderName}`
                    : `${currentParentPath}/${folderName}`;
            }
        }

        // Upload to S3
        const s3Key = `shared-drives/${id}/${Date.now()}-${file.originalname}`;
        await s3.upload({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype
        }).promise();

        // Create file record
        const newFile = await File.create({
            fileName: file.originalname,
            s3Key,
            size: file.size,
            mimeType: file.mimetype,
            folderPath,
            sharedDriveId: id,
            ownerId: null
        });

        res.status(201).json({ message: "File uploaded to shared drive", file: newFile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Download folder in shared drive as ZIP
exports.downloadFolderInDrive = async (req, res) => {
    try {
        const { id, folderId } = req.params;
        const userId = req.user.userId;
        const userEmail = req.user.email;
        const archiver = require("archiver");
        const s3 = require("../services/s3.service");

        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        // Check permissions (Member can download)
        const member = sharedDrive.members.find(m => m.email === userEmail);
        if (!member) {
            return res.status(403).json({ message: "Access denied" });
        }

        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ message: "Folder not found" });
        }

        // Verify folder belongs to this shared drive
        if (folder.sharedDriveId.toString() !== id) {
            return res.status(400).json({ message: "Folder does not belong to this shared drive" });
        }

        // Set headers for ZIP download
        res.attachment(`${folder.name}.zip`);

        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(res);

        // Helper to add folder contents recursively
        const addFolderToArchive = async (currentFolder, archivePath) => {
            const currentParentPath = currentFolder.parentPath === "/" ? "" : currentFolder.parentPath;
            const currentFullPath = `${currentParentPath}/${currentFolder.name}`;

            // Get subfolders in this drive
            const subfolders = await Folder.find({
                sharedDriveId: id,
                parentPath: currentFullPath
            });

            // Get files in this folder
            const files = await File.find({
                sharedDriveId: id,
                folderPath: currentFullPath
            });

            // Add files to archive
            for (const file of files) {
                const s3Stream = s3.getObject({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: file.s3Key
                }).createReadStream();

                const zipName = archivePath ? `${archivePath}/${file.fileName}` : file.fileName;
                archive.append(s3Stream, { name: zipName });
            }

            // Recursively add subfolders
            for (const subfolder of subfolders) {
                const nextArchivePath = archivePath ? `${archivePath}/${subfolder.name}` : subfolder.name;
                archive.append(Buffer.from([]), { name: `${nextArchivePath}/` });
                await addFolderToArchive(subfolder, nextArchivePath);
            }
        };

        await addFolderToArchive(folder, "");
        await archive.finalize();

    } catch (err) {
        console.error("DOWNLOAD SHARED DRIVE FOLDER ERROR:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
};

// Delete item (file or folder) in shared drive
exports.deleteItemInDrive = async (req, res) => {
    try {
        const { id, type, itemId } = req.params;
        const userEmail = req.user.email;

        // 1. Verify Shared Drive Access
        const sharedDrive = await SharedDrive.findById(id);
        if (!sharedDrive) {
            return res.status(404).json({ message: "Shared drive not found" });
        }

        const member = sharedDrive.members.find(m => m.email === userEmail);
        if (!member) {
            return res.status(403).json({ message: "Access denied" });
        }

        // 2. Verify Role (Admins and Editors can delete, Viewers cannot)
        // Adjust roles as per your requirement. Usually "Content Manager" or "Manager" can delete.
        if (member.role === "viewer") {
            return res.status(403).json({ message: "Viewers cannot delete items" });
        }

        // 3. Process Deletion
        if (type === "file") {
            const file = await File.findById(itemId);
            if (!file) return res.status(404).json({ message: "File not found" });

            if (file.sharedDriveId.toString() !== id) {
                return res.status(400).json({ message: "File does not belong to this shared drive" });
            }

            // Soft delete
            // Actually, for shared drives, we might want to move to a specialized "Trash" or delete permanently.
            // Let's do permanent delete for now to match behavior, or soft delete if 'isDeleted' schema supports it.
            // Looking at file controller, we use soft delete.
            file.isDeleted = true; // Wait, shared drive files might need explicit 'isDeleted' handling in queries?
            // Yes, listSharedDrives filters by folders/files... wait.
            // getSharedDriveContents -> Folder.find({ sharedDriveId: id }) - DOES NOT check isDeleted!
            // We need to FIX getSharedDriveContents too if we use soft delete.
            // For now, let's HARD DELETE to ensure they disappear, as shared drive trash management is complex.

            // Actually, let's use soft delete but we must update the list query.
            // But wait, the previous code for normal drive uses soft delete.
            // Let's stick to HARD DELETE for Shared Drive items for simplicity unless user asked for Trash bin.
            // The prompt says "no option to delete".

            // Hard Delete S3 Object
            const s3 = require("../services/s3.service");
            try {
                await s3.deleteObject({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: file.s3Key
                }).promise();
            } catch (e) {
                console.error("S3 Delete Error", e);
            }

            await File.findByIdAndDelete(itemId);
            return res.json({ message: "File deleted" });
        }

        if (type === "folder") {
            const folder = await Folder.findById(itemId);
            if (!folder) return res.status(404).json({ message: "Folder not found" });

            if (folder.sharedDriveId.toString() !== id) {
                return res.status(400).json({ message: "Folder does not belong to this shared drive" });
            }

            // Recursive Hard Delete
            const parentPathStr = folder.parentPath === "/" ? "" : folder.parentPath;
            const fullFolderPath = `${parentPathStr}/${folder.name}`;

            // Delete all sub-files
            const filesToDelete = await File.find({
                sharedDriveId: id,
                folderPath: { $regex: `^${fullFolderPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
            });

            const s3 = require("../services/s3.service");
            for (const f of filesToDelete) {
                try {
                    await s3.deleteObject({
                        Bucket: process.env.AWS_S3_BUCKET,
                        Key: f.s3Key
                    }).promise();
                } catch (e) { console.error(e); }
                await File.findByIdAndDelete(f._id);
            }

            // Delete subfolders
            await Folder.deleteMany({
                sharedDriveId: id,
                parentPath: { $regex: `^${fullFolderPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
            });

            // Delete the folder itself
            await Folder.findByIdAndDelete(itemId);

            return res.json({ message: "Folder deleted" });
        }

        res.status(400).json({ message: "Invalid type" });

    } catch (err) {
        console.error("Delete Item In Drive Error:", err);
        res.status(500).json({ error: err.message });
    }
};
