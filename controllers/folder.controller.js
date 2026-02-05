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

    // Escape special characters for regex
    const escapedPath = folderFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Regex to match exact path or subpaths: matches "/path" (end) or "/path/" (nested)
    const pathRegex = new RegExp(`^${escapedPath}(/|$)`);

    // Find all files in this folder and subfolders
    const filesToDelete = await File.find({
      ownerId: userId,
      folderPath: { $regex: pathRegex }
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
      folderPath: { $regex: pathRegex }
    });

    // Find all subfolders
    await Folder.deleteMany({
      ownerId: userId,
      parentPath: { $regex: pathRegex }
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

    // CHECK FOR CIRCULAR MOVE
    // Check if targetPath starts with oldFullPath (e.g. moving /A to /A/B)
    // We append a slash to ensure we don't match partial names (e.g. /Test vs /Test2)
    // Exception: if targetPath IS oldFullPath (same location), we caught that in frontend but check here too
    if (targetPath === oldFullPath || targetPath.startsWith(oldFullPath + "/")) {
      return res.status(400).json({ message: "Cannot move a folder into itself or its own subfolder" });
    }

    // Update folder's parentPath
    folder.parentPath = targetPath;
    await folder.save();

    // Escape special characters for regex
    const escapedOldPath = oldFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Regex to match exact path or subpaths: matches "/path" (end) or "/path/" (nested)
    // using strict boundary check to avoid partial matches (e.g. matching "/Test2" when looking for "/Test")
    const pathRegex = new RegExp(`^${escapedOldPath}(/|$)`);

    // Update all subfolders' parentPath
    await Folder.updateMany(
      { ownerId: userId, parentPath: { $regex: pathRegex } },
      [{ $set: { parentPath: { $replaceOne: { input: "$parentPath", find: oldFullPath, replacement: newFullPath } } } }]
    );

    // Update all files' folderPath
    await File.updateMany(
      { ownerId: userId, folderPath: { $regex: pathRegex } },
      [{ $set: { folderPath: { $replaceOne: { input: "$folderPath", find: oldFullPath, replacement: newFullPath } } } }]
    );

    res.json({ message: "Folder moved successfully", folder });

  } catch (err) {
    console.error("MOVE FOLDER ERROR:", err);
    res.status(500).json({ message: err.message, error: err.message });
  }
};

// Download folder as ZIP
exports.downloadFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const folderId = req.params.id;
    const archiver = require("archiver");

    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    if (folder.ownerId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Set headers for ZIP download
    res.attachment(`${folder.name}.zip`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // Helper to add folder contents recursively
    const addFolderToArchive = async (currentFolder, archivePath) => {
      // Calculate pathPrefix for database query
      // If currentFolder is the root of the download, we want files inside it.
      // Files inside have folderPath = currentFolder.parentPath + "/" + currentFolder.name

      const currentParentPath = currentFolder.parentPath === "/" ? "" : currentFolder.parentPath;
      const currentFullPath = `${currentParentPath}/${currentFolder.name}`;

      // Get subfolders
      const subfolders = await Folder.find({
        ownerId: userId,
        parentPath: currentFullPath,
        isDeleted: { $ne: true }
      });

      // Get files in this folder
      const files = await File.find({
        ownerId: userId,
        folderPath: currentFullPath,
        isDeleted: { $ne: true }
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
        // Add an empty folder entry if needed (archiver handles this usually by file paths, but good to ensure empty dirs exist)
        archive.append(Buffer.from([]), { name: `${nextArchivePath}/` });

        await addFolderToArchive(subfolder, nextArchivePath);
      }
    };

    await addFolderToArchive(folder, "");
    await archive.finalize();

  } catch (err) {
    console.error("DOWNLOAD FOLDER ERROR:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};
