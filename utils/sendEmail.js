const nodemailer = require("nodemailer");

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("EMAIL CREDENTIALS MISSING", {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS ? "SET" : "NOT SET"
  });
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // Use SSL
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  family: 4, // Force IPv4 to avoid ipv6 connection issues
  connectionTimeout: 30000, // 30 seconds
  socketTimeout: 30000,
  logger: true,
  debug: true
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log(`Attempting to send email to ${to}`);
    const info = await transporter.sendMail({
      from: `"Google Drive Clone" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log("Email sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error; // Re-throw to be caught by controller
  }
};

module.exports = sendEmail;
