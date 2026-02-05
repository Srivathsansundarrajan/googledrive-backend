const mongoose = require('mongoose');
const Folder = require('./models/Folder');
const File = require('./models/File');
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const userId = "testuser123"; // Mock user
        // Clean up
        await Folder.deleteMany({ ownerId: userId });
        await File.deleteMany({ ownerId: userId });

        // 1. Create Source Folder "todo"
        const todo = await Folder.create({
            name: "todo",
            ownerId: userId,
            parentPath: "/"
        });
        console.log("Created todo:", todo._id);

        // 2. Create Destination Folder "dummy"
        const dummy = await Folder.create({
            name: "dummy",
            ownerId: userId,
            parentPath: "/"
        });
        console.log("Created dummy:", dummy._id);

        // 3. Attempt Move Logic (Copied from Controller Fix)
        const folderId = todo._id;
        const targetPath = `/${dummy.name}`; // "/dummy"

        console.log("Attempting move to:", targetPath);

        const folder = await Folder.findById(folderId);
        if (!folder) throw new Error("Folder not found");

        const oldFullPath = folder.parentPath === "/"
            ? `/${folder.name}`
            : `${folder.parentPath}/${folder.name}`;

        const newFullPath = targetPath === "/"
            ? `/${folder.name}`
            : `${targetPath}/${folder.name}`;

        console.log("Old Path:", oldFullPath);
        console.log("New Path:", newFullPath);

        // THE FIX LOGIC
        folder.parentPath = targetPath;
        await folder.save();

        const escapedOldPath = oldFullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pathRegex = new RegExp(`^${escapedOldPath}(/|$)`);

        console.log("Regex:", pathRegex);

        const subfolders = await Folder.find({ ownerId: userId, parentPath: { $regex: pathRegex } });
        console.log("Subfolders logic check:", subfolders);

        await Folder.updateMany(
            { ownerId: userId, parentPath: { $regex: pathRegex } },
            [{ $set: { parentPath: { $replaceOne: { input: "$parentPath", find: oldFullPath, replacement: newFullPath } } } }]
        );

        await File.updateMany(
            { ownerId: userId, folderPath: { $regex: pathRegex } },
            [{ $set: { folderPath: { $replaceOne: { input: "$folderPath", find: oldFullPath, replacement: newFullPath } } } }]
        );

        console.log("Move completed successfully (simulation)");

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        await mongoose.connection.close();
    }
};

run();
