const s3 = require("../services/s3.service");
const File = require("../models/File");
const Folder = require("../models/Folder");
const unzipper = require("unzipper");
const path = require("path");
const { Readable } = require("stream");


exports.uploadFile = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user.userId;
    const folderPath = req.body.path || "/";

    console.log("UPLOAD REQUEST:", {
      fileName: file?.originalname,
      folderPath,
      conflictAction: req.body.conflictAction,
      customName: req.body.customName
    });

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const isZip =
      file.mimetype === "application/zip" ||
      file.originalname.endsWith(".zip");

    /* ---------------- ZIP UPLOAD ---------------- */
    if (isZip) {
      const createdFolders = new Set();
      const conflictAction = req.body.conflictAction; // merge, replace, or rename
      const customName = req.body.customName;

      // Determine folder name - use custom name if renaming
      let zipFolderName = customName || file.originalname.replace(/\.zip$/i, '');

      console.log("ZIP upload with conflict handling:", { conflictAction, customName, zipFolderName });

      // Handle replace action - delete existing folder first
      if (conflictAction === "replace") {
        const existingFolder = await Folder.findOne({
          ownerId: userId,
          name: zipFolderName,
          parentPath: folderPath
        });

        if (existingFolder) {
          const folderFullPath = folderPath === "/"
            ? `/${zipFolderName}`
            : `${folderPath}/${zipFolderName}`;

          // Delete all files in the folder from S3 and DB
          const filesToDelete = await File.find({
            ownerId: userId,
            folderPath: { $regex: `^${folderFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
          });

          for (const f of filesToDelete) {
            try {
              await s3.deleteObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: f.s3Key,
              }).promise();
            } catch (e) {
              console.error("S3 delete error:", e);
            }
          }

          await File.deleteMany({
            ownerId: userId,
            folderPath: { $regex: `^${folderFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
          });

          // Delete subfolders
          await Folder.deleteMany({
            ownerId: userId,
            parentPath: { $regex: `^${folderFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
          });

          // Delete the folder itself
          await Folder.findByIdAndDelete(existingFolder._id);

          console.log("Deleted existing folder for replace:", folderFullPath);
        }
      }

      // Create the folder (with possibly new name)
      await Folder.findOneAndUpdate(
        { ownerId: userId, name: zipFolderName, parentPath: folderPath },
        { ownerId: userId, name: zipFolderName, parentPath: folderPath },
        { upsert: true, new: true }
      );
      const zipBasePath = folderPath === "/" ? `/${zipFolderName}` : `${folderPath}/${zipFolderName}`;
      createdFolders.add(zipBasePath);

      console.log("ZIP extraction started:", { zipFolderName, zipBasePath });

      // Use Open.buffer for more reliable ZIP extraction
      const directory = await unzipper.Open.buffer(file.buffer);

      console.log("ZIP contains files:", directory.files.map(f => f.path));

      const uploadPromises = directory.files
        .filter(entry => entry.type === "File")
        .map(async (entry) => {
          const entryPath = entry.path;
          const s3Key = `users/${userId}/${zipFolderName}/${entryPath}`;

          // Get file content as buffer
          const content = await entry.buffer();

          // Upload to S3
          await s3.upload({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: s3Key,
            Body: content,
          }).promise();

          // Calculate folder path - nest inside the ZIP folder
          const entryDir = path.dirname(entryPath).replace(/\\/g, "/");
          const fileFolderPath = entryDir === "."
            ? zipBasePath
            : `${zipBasePath}/${entryDir}`;

          console.log("Saving file:", { fileName: path.basename(entryPath), folderPath: fileFolderPath });

          // Auto-create nested subfolders if needed
          if (fileFolderPath !== zipBasePath && !createdFolders.has(fileFolderPath)) {
            // Create all parent folders in the path
            const relativePath = fileFolderPath.replace(zipBasePath, '').split('/').filter(Boolean);
            let currentPath = zipBasePath;

            for (const folderName of relativePath) {
              const parentPath = currentPath;
              currentPath = `${currentPath}/${folderName}`;

              if (!createdFolders.has(currentPath)) {
                await Folder.findOneAndUpdate(
                  { ownerId: userId, name: folderName, parentPath },
                  { ownerId: userId, name: folderName, parentPath },
                  { upsert: true, new: true }
                );
                createdFolders.add(currentPath);
              }
            }
          }

          // Save file metadata to DB
          await File.create({
            ownerId: userId,
            fileName: path.basename(entryPath),
            s3Key,
            folderPath: fileFolderPath,
          });
        });

      await Promise.all(uploadPromises);

      console.log("ZIP extraction complete. Created folders:", Array.from(createdFolders));

      return res.status(201).json({
        message: "ZIP uploaded and extracted successfully",
        folder: zipFolderName
      });
    }

    /* ---------------- NORMAL FILE UPLOAD ---------------- */
    const conflictAction = req.body.conflictAction;
    const customName = req.body.customName;
    let actualFolderPath = folderPath;

    // Handle folder rename for folder uploads
    if (customName && folderPath !== "/") {
      const pathParts = folderPath.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        pathParts[0] = customName;
        actualFolderPath = "/" + pathParts.join("/");
      }
    }

    // Handle replace action for folder uploads
    // Only delete if folder has OLD files (created more than 5 seconds ago)
    if (conflictAction === "replace" && actualFolderPath !== "/") {
      const pathParts = actualFolderPath.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        const topFolderName = pathParts[0];
        const existingFolder = await Folder.findOne({
          ownerId: userId,
          name: topFolderName,
          parentPath: "/"
        });

        if (existingFolder) {
          const folderFullPath = `/${topFolderName}`;
          const fiveSecondsAgo = new Date(Date.now() - 5000);

          // Only delete files created before this upload batch (5+ seconds old)
          const oldFilesToDelete = await File.find({
            ownerId: userId,
            folderPath: { $regex: `^${folderFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
            createdAt: { $lt: fiveSecondsAgo }
          });

          // Only proceed with delete if there are old files
          if (oldFilesToDelete.length > 0) {
            console.log(`Deleting ${oldFilesToDelete.length} old files for replace in ${folderFullPath}`);

            for (const f of oldFilesToDelete) {
              try {
                await s3.deleteObject({
                  Bucket: process.env.AWS_S3_BUCKET,
                  Key: f.s3Key,
                }).promise();
              } catch (e) {
                console.error("S3 delete error:", e);
              }
            }

            await File.deleteMany({
              ownerId: userId,
              folderPath: { $regex: `^${folderFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
              createdAt: { $lt: fiveSecondsAgo }
            });

            // Delete old subfolders and the folder itself only if old files existed
            await Folder.deleteMany({
              ownerId: userId,
              parentPath: { $regex: `^${folderFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
            });

            // Delete the folder itself so it gets recreated fresh
            await Folder.findByIdAndDelete(existingFolder._id);

            console.log("Deleted existing folder for replace:", folderFullPath);
          }
        }
      }
    }

    const s3Key = `users/${userId}/${Date.now()}_${file.originalname}`;

    await s3.upload({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }).promise();

    // Auto-create parent folders for the entire path
    if (actualFolderPath !== "/") {
      const pathParts = actualFolderPath.split("/").filter(Boolean);
      let currentParentPath = "/";

      // Create each folder in the path if it doesn't exist
      for (let i = 0; i < pathParts.length; i++) {
        const folderName = pathParts[i];

        await Folder.findOneAndUpdate(
          { ownerId: userId, name: folderName, parentPath: currentParentPath },
          { ownerId: userId, name: folderName, parentPath: currentParentPath },
          { upsert: true, new: true }
        );

        // Update parent path for next folder
        currentParentPath = currentParentPath === "/"
          ? `/${folderName}`
          : `${currentParentPath}/${folderName}`;
      }

      console.log("Created folder structure:", actualFolderPath);
    }

    const savedFile = await File.create({
      ownerId: userId,
      fileName: file.originalname,
      s3Key,
      size: file.size,
      mimeType: file.mimetype,
      folderPath: actualFolderPath
    });


    return res.status(201).json({
      message: "File uploaded successfully",
      file: savedFile,
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    return res.status(500).json({ error: err.message });
  }
};


exports.listFiles = async (req, res) => {
  try {
    const userId = req.user.userId;
    const path = req.query.path || "/";

    const files = await File.find({
      ownerId: userId,
      folderPath: path,
      isDeleted: { $ne: true }
    });

    const folders = await Folder.find({
      ownerId: userId,
      parentPath: path,
      isDeleted: { $ne: true }
    });

    res.json({
      path,
      folders,
      files
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.previewFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const fileId = req.params.id;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Check access: owner OR shared drive member
    let hasAccess = file.ownerId?.toString() === userId;

    // If file belongs to a shared drive, check if user is a member
    if (!hasAccess && file.sharedDriveId) {
      const SharedDrive = require("../models/SharedDrive");
      const drive = await SharedDrive.findById(file.sharedDriveId);
      if (drive) {
        hasAccess = drive.members.some(m => m.email === userEmail);
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const previewUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key,
      Expires: 300 // 5 minutes for preview
    });

    res.json({ previewUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const fileId = req.params.id;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Check access: owner OR shared drive member
    let hasAccess = file.ownerId?.toString() === userId;

    // If file belongs to a shared drive, check if user is a member
    if (!hasAccess && file.sharedDriveId) {
      const SharedDrive = require("../models/SharedDrive");
      const drive = await SharedDrive.findById(file.sharedDriveId);
      if (drive) {
        hasAccess = drive.members.some(m => m.email === userEmail);
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Force download
    const downloadUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key,
      Expires: 300,
      ResponseContentDisposition: `attachment; filename="${file.fileName}"`
    });

    res.json({ downloadUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const fileId = req.params.id;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    if (file.ownerId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Soft delete - move to trash (don't delete from S3 yet)
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    res.json({ message: "File moved to trash" });

  } catch (err) {
    console.error("DELETE FILE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// Search files and folders
exports.searchFiles = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = req.query.q || "";

    if (query.length < 2) {
      return res.json({ results: [] });
    }

    const searchRegex = new RegExp(query, "i");

    // Search files
    const files = await File.find({
      ownerId: userId,
      fileName: searchRegex,
      isDeleted: { $ne: true }
    }).limit(10).lean();

    // Search folders
    const folders = await Folder.find({
      ownerId: userId,
      name: searchRegex,
      isDeleted: { $ne: true }
    }).limit(10).lean();

    const results = [
      ...folders.map(f => ({
        type: "folder",
        _id: f._id,
        name: f.name,
        path: f.parentPath
      })),
      ...files.map(f => ({
        type: "file",
        _id: f._id,
        name: f.fileName,
        path: f.folderPath
      }))
    ];

    res.json({ results });
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// Move file to a new folder
exports.moveFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const fileId = req.params.id;
    const { targetPath } = req.body;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    if (file.ownerId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    file.folderPath = targetPath;
    await file.save();

    res.json({ message: "File moved successfully", file });

  } catch (err) {
    console.error("MOVE FILE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
