const Folder = require("../models/Folder");
const File = require("../models/File");
const s3 = require("../services/s3.service");

exports.createFolder = async (req, res) => {
  try {
    const { name, parentPath = "/" } = req.body;
    const userId = req.user.userId;

    if (!name) {
      return res.status(400).json({ message: "Folder name required" });
    }

    const folder = await Folder.create({
      name,
      ownerId: userId,
      parentPath
    });

    res.status(201).json({
      message: "Folder created",
      folder
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.checkFolderExists = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, parentPath = "/" } = req.query;

    const folder = await Folder.findOne({
      ownerId: userId,
      name,
      parentPath
    });

    res.json({ exists: !!folder, folder });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const folderId = req.params.id;

    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    if (folder.ownerId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Calculate the full path of this folder
    const folderFullPath = folder.parentPath === "/"
      ? `/${folder.name}`
      : `${folder.parentPath}/${folder.name}`;

    // Find all files in this folder and subfolders
    const filesToDelete = await File.find({
      ownerId: userId,
      folderPath: { $regex: `^${folderFullPath}` }
    });

    // Delete files from S3
    for (const file of filesToDelete) {
      try {
        await s3.deleteObject({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: file.s3Key,
        }).promise();
      } catch (s3Err) {
        console.error("S3 delete error:", s3Err);
      }
    }

    // Delete files from database
    await File.deleteMany({
      ownerId: userId,
      folderPath: { $regex: `^${folderFullPath}` }
    });

    // Find all subfolders
    await Folder.deleteMany({
      ownerId: userId,
      parentPath: { $regex: `^${folderFullPath}` }
    });

    // Delete the folder itself
    await Folder.findByIdAndDelete(folderId);

    res.json({ message: "Folder and contents deleted successfully" });

  } catch (err) {
    console.error("DELETE FOLDER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// Move folder to a new location
exports.moveFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const folderId = req.params.id;
    const { targetPath } = req.body;

    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    if (folder.ownerId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Calculate old full path
    const oldFullPath = folder.parentPath === "/"
      ? `/${folder.name}`
      : `${folder.parentPath}/${folder.name}`;

    // Calculate new full path
    const newFullPath = targetPath === "/"
      ? `/${folder.name}`
      : `${targetPath}/${folder.name}`;

    // Update folder's parentPath
    folder.parentPath = targetPath;
    await folder.save();

    // Update all subfolders' parentPath
    await Folder.updateMany(
      { ownerId: userId, parentPath: { $regex: `^${oldFullPath}` } },
      [{ $set: { parentPath: { $replaceOne: { input: "$parentPath", find: oldFullPath, replacement: newFullPath } } } }]
    );

    // Update all files' folderPath
    await File.updateMany(
      { ownerId: userId, folderPath: { $regex: `^${oldFullPath}` } },
      [{ $set: { folderPath: { $replaceOne: { input: "$folderPath", find: oldFullPath, replacement: newFullPath } } } }]
    );

    res.json({ message: "Folder moved successfully", folder });

  } catch (err) {
    console.error("MOVE FOLDER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
