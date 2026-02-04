const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const folderController = require("../controllers/folder.controller");

router.post(
  "/create",
  authMiddleware,
  folderController.createFolder
);

router.get(
  "/check-exists",
  authMiddleware,
  folderController.checkFolderExists
);

router.delete(
  "/:id",
  authMiddleware,
  folderController.deleteFolder
);

// Move folder
router.put(
  "/:id/move",
  authMiddleware,
  folderController.moveFolder
);

// Download folder
router.get(
  "/:id/download",
  authMiddleware,
  folderController.downloadFolder
);

module.exports = router;
