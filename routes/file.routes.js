
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const { upload, handleMulterError } = require("../middleware/upload.middleware");
const fileController = require("../controllers/file.controller");
// router.options("*", cors());
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  handleMulterError,
  fileController.uploadFile
);

router.get(
  "/list",
  authMiddleware,
  fileController.listFiles
);


router.get(
  "/preview/:id",
  authMiddleware,
  fileController.previewFile
);

router.get(
  "/download/:id",
  authMiddleware,
  fileController.downloadFile
);

router.delete(
  "/:id",
  authMiddleware,
  fileController.deleteFile
);

router.get(
  "/search",
  authMiddleware,
  fileController.searchFiles
);

// Move file
router.put(
  "/:id/move",
  authMiddleware,
  fileController.moveFile
);

module.exports = router;

