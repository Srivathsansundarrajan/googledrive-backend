const File = require("../models/File");
const Folder = require("../models/Folder");

// Toggle starred status for file or folder
exports.toggleStarred = async (req, res) => {
    try {
        const { type, id } = req.params;
        const userId = req.user.userId;

        let item;
        if (type === "file") {
            item = await File.findOne({ _id: id, ownerId: userId, isDeleted: false });
        } else if (type === "folder") {
            item = await Folder.findOne({ _id: id, ownerId: userId, isDeleted: false });
        } else {
            return res.status(400).json({ error: "Invalid type. Must be 'file' or 'folder'" });
        }

        if (!item) {
            return res.status(404).json({ error: `${type} not found` });
        }

        item.isStarred = !item.isStarred;
        await item.save();

        res.json({
            success: true,
            isStarred: item.isStarred,
            message: item.isStarred ? "Added to starred" : "Removed from starred"
        });
    } catch (err) {
        console.error("Toggle starred error:", err);
        res.status(500).json({ error: err.message });
    }
};

// Get all starred items
exports.getStarred = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [files, folders] = await Promise.all([
            File.find({ ownerId: userId, isStarred: true, isDeleted: false }),
            Folder.find({ ownerId: userId, isStarred: true, isDeleted: false })
        ]);

        res.json({ files, folders });
    } catch (err) {
        console.error("Get starred error:", err);
        res.status(500).json({ error: err.message });
    }
};
