const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/register", authController.register);
router.get("/activate/:token", authController.activate);
router.post("/login", authController.login);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

router.post(
  "/change-password",
  authMiddleware,
  authController.changePassword
);

module.exports = router;
