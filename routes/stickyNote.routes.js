const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const stickyNoteController = require("../controllers/stickyNote.controller");

// Add a note
router.post("/", authMiddleware, stickyNoteController.addNote);

// Get notes for a resource
router.get("/:resourceType/:resourceId", authMiddleware, stickyNoteController.getNotes);

// Update a note
router.put("/:id", authMiddleware, stickyNoteController.updateNote);

// Delete a note
router.delete("/:id", authMiddleware, stickyNoteController.deleteNote);

module.exports = router;
