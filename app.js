const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authMiddleware = require("./middleware/auth.middleware");

const app = express();

/* ---------- CORS (local + deployed frontend) ---------- */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://your-frontend.vercel.app" // replace after frontend deploy
    ],
    credentials: true
  })
);

/* ---------- Middleware ---------- */
app.use(express.json());

/* ---------- Routes ---------- */
app.use("/auth", require("./routes/auth.routes"));
app.use("/files", require("./routes/file.routes"));
app.use("/folders", require("./routes/folder.routes"));
app.use("/shared-drives", require("./routes/sharedDrive.routes"));
app.use("/share", require("./routes/share.routes"));
app.use("/chat", require("./routes/chat.routes"));
app.use("/notes", require("./routes/stickyNote.routes"));
app.use("/access", require("./routes/accessLog.routes"));
app.use("/trash", require("./routes/trash.routes"));
app.use("/storage", require("./routes/storage.routes"));
app.use("/notifications", require("./routes/notification.routes"));
app.use("/starred", require("./routes/starred.routes"));

/* ---------- Health Check ---------- */
app.get("/", (req, res) => {
  res.send("Google Drive Backend Running");
});

/* ---------- Protected Test Route ---------- */
app.get("/protected", authMiddleware, (req, res) => {
  res.json({
    message: "You have access to protected route",
    user: req.user
  });
});

module.exports = app;
