const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Token = require("../models/Token");
const PasswordResetToken = require("../models/PasswordResetToken");
const sendEmail = require("../utils/sendEmail");

exports.register = async (req, res) => {
  try {
    const { email, firstName, lastName, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      firstName,
      lastName,
      password: hashed,
      isActive: false
    });

    // Generate activation token
    const tokenValue = crypto.randomBytes(32).toString("hex");

    await Token.create({
      userId: user._id,
      token: tokenValue,
      type: "activation",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    // Generate link to FRONTEND activation page
    const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "http://localhost:5173";
    const activationLink = `${clientUrl}/activate/${tokenValue}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Activate your Google Drive account",
        html: `
          <h3>Account Activation</h3>
          <p>Click the link below to activate your account:</p>
          <a href="${activationLink}">${activationLink}</a>
        `
      });
      console.log("Activation email sent successfully");
    } catch (emailError) {
      console.error("Failed to send activation email:", emailError);
      return res.status(500).json({
        message: "Account created but failed to send email. please try again.",
        error: emailError.message
      });
    }


    res.status(201).json({
      message: "Registered successfully. Please activate via email."
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.activate = async (req, res) => {
  try {
    const { token } = req.params;

    const tokenDoc = await Token.findOne({
      token,
      type: "activation",
      used: false,
      expiresAt: { $gt: Date.now() }
    });

    if (!tokenDoc) {
      return res.status(400).json({ message: "Invalid or expired activation link" });
    }

    await User.findByIdAndUpdate(tokenDoc.userId, {
      isActive: true
    });

    tokenDoc.used = true;
    await tokenDoc.save();

    res.json({ message: "Account activated successfully. You can now log in." });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// LOGIN CONTROLLER
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 2. Check if account is activated
    if (!user.isActive) {
      return res.status(403).json({ message: "Please activate your account via email" });
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 5. Send response
    res.status(200).json({
      message: "Login successful",
      token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await PasswordResetToken.create({
      userId: user._id,
      token,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes
    });

    // Generate link to FRONTEND reset page
    const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "http://localhost:5173";
    const resetLink = `${clientUrl}/reset-password/${token}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Google Drive password",
      html: `
        <h3>Password Reset</h3>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 15 minutes.</p>
      `
    });


    res.json({ message: "Password reset email sent" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    const resetToken = await PasswordResetToken.findOne({ token });

    if (!resetToken || resetToken.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.findByIdAndUpdate(resetToken.userId, {
      password: hashedPassword
    });

    await PasswordResetToken.deleteOne({ _id: resetToken._id });

    res.json({ message: "Password reset successful" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both passwords are required" });
    }

    const user = await User.findById(userId);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: "Password changed successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


console.log("DEBUG changePassword export:", exports.changePassword);