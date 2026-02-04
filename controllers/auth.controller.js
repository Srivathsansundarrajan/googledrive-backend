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

    console.log("GENERATED ACTIVATION LINK:", activationLink); // Debug log

    try {
      await sendEmail({
        to: user.email,
        subject: "Verify your email for Google Drive Clone",
        html: `
          <div style="font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #1a73e8; font-size: 24px; margin: 0;">Google Drive Clone</h1>
            </div>
            
            <div style="padding: 20px 0;">
              <h2 style="font-size: 20px; color: #202124; margin-bottom: 16px;">Verify your email address</h2>
              <p style="font-size: 16px; color: #3c4043; line-height: 1.5; margin-bottom: 24px;">
                Thanks for creating an account! Please confirm that <strong>${user.email}</strong> is your email address by clicking the button below.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${activationLink}" style="background-color: #1a73e8; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: 500; font-size: 16px; display: inline-block;">
                  Verify Email
                </a>
              </div>
              
              <p style="font-size: 14px; color: #5f6368; margin-top: 24px;">
                Or paste this link into your browser: <br>
                <a href="${activationLink}" style="color: #1a73e8; word-break: break-all;">${activationLink}</a>
              </p>
            </div>
            
            <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px; text-align: center;">
              <p style="font-size: 12px; color: #9aa0a6;">
                This is a project for the GUVI Hackathon. If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          </div>
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