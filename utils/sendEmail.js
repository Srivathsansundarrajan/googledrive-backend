const nodemailer = require("nodemailer");

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("EMAIL CREDENTIALS MISSING", {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS ? "SET" : "NOT SET"
  });
}

const { Resend } = require("resend");

// 1. Setup Nodemailer (Fallback)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 2. Setup Resend (Primary since Render blocks Gmail)
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log(`Attempting to send email to ${to}`);

    // OPTION A: Use Resend if available (Recommended for Cloud)
    if (resend) {
      console.log("Using Resend API...");
      const data = await resend.emails.send({
        from: "Google Drive Clone <onboarding@resend.dev>", // Free tier must use this or verified domain
        to: [to],
        subject: subject,
        html: html,
      });
      console.log("Email sent via Resend:", data);
      return data;
    }

    // OPTION B: Use Gmail SMTP (Likely to fail on Render free tier)
    console.log("Using Gmail SMTP...");
    const info = await transporter.sendMail({
      from: `"Google Drive Clone" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log("Email sent via Gmail: %s", info.messageId);
    return info;

  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = sendEmail;
