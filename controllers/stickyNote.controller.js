const StickyNote = require("../models/StickyNote");
const File = require("../models/File");
const Folder = require("../models/Folder");

const SharedDrive = require("../models/SharedDrive");
const notificationController = require("../controllers/notification.controller");

// Add a sticky note
exports.addNote = async (req, res) => {
    try {
        const { resourceType, resourceId, content, color = "yellow" } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        if (!resourceType || !resourceId || !content) {
            return res.status(400).json({ message: "resourceType, resourceId, and content are required" });
        }

        // Verify resource exists and check for shared drive context
        const Model = resourceType === "file" ? File : Folder;
        const resource = await Model.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ message: "Resource not found" });
        }

        const note = await StickyNote.create({
            resourceType,
            resourceId,
            createdBy: userId,
            creatorEmail: userEmail,
            content,
            color
        });

        // Notify shared drive members if applicable
        if (resource.sharedDriveId) {
            const sharedDrive = await SharedDrive.findById(resource.sharedDriveId);
            if (sharedDrive) {
                const otherMembers = sharedDrive.members.filter(m => m.email !== userEmail);
                const resourceName = resourceType === "file" ? resource.fileName : resource.name;

                // Prepare notifications batch
                const notifications = otherMembers.map(member => {
                    if (!member.userId) return null;
                    return {
                        recipientId: member.userId,
                        type: "note",
                        title: `New sticky note in ${sharedDrive.name}`,
                        message: `${userEmail.split("@")[0]} added a note to ${resourceName}`,
                        link: `/shared-drives/${sharedDrive._id}`
                    };
                }).filter(Boolean); // Remove nulls

                // Batch insert
                if (notifications.length > 0) {
                    await notificationController.createManyNotifications(notifications);
                }
            }
        }

        res.status(201).json({ message: "Note added", note });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get notes for a resource
exports.getNotes = async (req, res) => {
    try {
        const { resourceType, resourceId } = req.params;

        const notes = await StickyNote.find({
            resourceType,
            resourceId
        }).sort({ createdAt: -1 });

        res.json({ notes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get notes for multiple resources (Batch)
exports.getBatchNotes = async (req, res) => {
    try {
        const { items } = req.body; // Array of { resourceType, resourceId }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.json({ notes: {} });
        }

        // Optimize: use $or query
        const queries = items.map(item => ({
            resourceType: item.resourceType,
            resourceId: item.resourceId
        }));

        const allNotes = await StickyNote.find({
            $or: queries
        }).sort({ createdAt: -1 });

        // Group by resource key
        const notesMap = {};
        allNotes.forEach(note => {
            const key = `${note.resourceType}-${note.resourceId}`;
            if (!notesMap[key]) {
                notesMap[key] = [];
            }
            notesMap[key].push(note);
        });

        res.json({ notes: notesMap });
    } catch (err) {
        console.error("Batch notes error:", err);
        res.status(500).json({ error: err.message });
    }
};

// Update a note
exports.updateNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, color } = req.body;
        const userId = req.user.userId;

        const note = await StickyNote.findById(id);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        if (note.createdBy.toString() !== userId) {
            return res.status(403).json({ message: "You can only edit your own notes" });
        }

        if (content) note.content = content;
        if (color) note.color = color;
        note.updatedAt = Date.now();

        await note.save();
        res.json({ message: "Note updated", note });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete a note
exports.deleteNote = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const note = await StickyNote.findById(id);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        if (note.createdBy.toString() !== userId) {
            return res.status(403).json({ message: "You can only delete your own notes" });
        }

        await StickyNote.findByIdAndDelete(id);
        res.json({ message: "Note deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
