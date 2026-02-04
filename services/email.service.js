const nodemailer = require("nodemailer");

// Create transporter - configure with your SMTP settings
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: true,
    auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    family: 4, // Force IPv4
    connectionTimeout: 30000, // 30 seconds
    socketTimeout: 30000
});

// Send share notification email
exports.sendShareNotification = async (recipientEmail, senderName, resourceName, resourceType, shareLink) => {
    try {
        if (!process.env.SMTP_USER) {
            console.log("[Email] SMTP not configured, skipping notification");
            return;
        }

        const mailOptions = {
            from: `"${senderName}" <${process.env.SMTP_USER}>`,
            to: recipientEmail,
            subject: `${senderName} shared a ${resourceType} with you`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a73e8;">📂 New ${resourceType} shared with you</h2>
                    <p><strong>${senderName}</strong> has shared "${resourceName}" with you.</p>
                    <p style="margin: 20px 0;">
                        <a href="${shareLink}" style="background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            Open ${resourceType}
                        </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">
                        If you don't recognize the sender, you can ignore this email.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Email] Share notification sent to ${recipientEmail}`);
    } catch (err) {
        console.error("[Email] Failed to send share notification:", err.message);
    }
};

// Send shared drive invitation email
exports.sendDriveInvitation = async (recipientEmail, senderName, driveName, role) => {
    try {
        const emailUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        if (!emailUser) {
            console.log("[Email] SMTP not configured, skipping invitation");
            return;
        }

        const mailOptions = {
            from: `"${senderName}" <${process.env.SMTP_USER}>`,
            to: recipientEmail,
            subject: `${senderName} invited you to "${driveName}"`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a73e8;">🏢 Shared Drive Invitation</h2>
                    <p><strong>${senderName}</strong> has invited you to join the shared drive "<strong>${driveName}</strong>".</p>
                    <p>Your role: <strong style="text-transform: capitalize;">${role}</strong></p>
                    <p style="margin: 20px 0;">
                        <a href="${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/shared-drives" style="background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            View Shared Drives
                        </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">
                        If you don't have an account yet, please sign up first to access the shared drive.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Email] Drive invitation sent to ${recipientEmail}`);
    } catch (err) {
        console.error("[Email] Failed to send drive invitation:", err.message);
    }
};

module.exports = exports;
