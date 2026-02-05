const nodemailer = require("nodemailer");

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("EMAIL CREDENTIALS MISSING", {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS ? "SET" : "NOT SET"
  });
}

const { Resend } = require("resend");

// 1. Setup Nodemailer (Fallback)
// 1. Setup Nodemailer (Fallback: Gmail)
const gmailTransporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 2. Setup Resend (Target 2)
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log(`Attempting to send email to ${to}`);

    // DEVELOPER BYPASS: If SKIP_EMAIL is true, just log the content and return success
    // This allows testing without a working email provider (e.g. if Brevo account is suspended)
    if (process.env.SKIP_EMAIL === "true") {
      console.log("---------------------------------------------------");
      console.log("⚠️ EMAIL BYPASS MODE ENABLED (SKIP_EMAIL=true) ⚠️");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log("Content/Link (Search here for links):");
      console.log(html); // Log HTML so user can find the href="..." link
      console.log("---------------------------------------------------");
      return { message: "Email skipped (Developer Mode)" };
    }

    // DETERMINE PROVIDER (brevo, resend, gmail, or auto)
    let provider = process.env.EMAIL_PROVIDER ? process.env.EMAIL_PROVIDER.toLowerCase() : 'auto';

    // Auto-resolution logic
    // Auto-resolution logic
    if (provider === 'auto') {
      if (process.env.BREVO_SMTP_KEY) provider = 'brevo-smtp';
      else if (process.env.BREVO_API_KEY) provider = 'brevo';
      else if (process.env.RESEND_API_KEY) provider = 'resend';
      else provider = 'gmail';
    }

    console.log(`Using Email Provider: ${provider.toUpperCase()}`);

    // OPTION A: Brevo
    if (provider === 'brevo') {
      if (!process.env.BREVO_API_KEY) throw new Error("BREVO_API_KEY is missing but provider is set to 'brevo'");

      console.log("Using Brevo API...");
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: { email: process.env.EMAIL_USER || "noreply@googledriveclone.com", name: "Google Drive Clone" },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Brevo Error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log("Email sent via Brevo:", data);
      return data;
    }

    // OPTION B: Resend
    if (provider === 'resend') {
      if (!resend) throw new Error("RESEND_API_KEY is missing/invalid but provider is set to 'resend'");

      console.log("Using Resend API...");
      const response = await resend.emails.send({
        from: "Google Drive Clone <onboarding@resend.dev>", // Free tier must use this or verified domain
        to: [to],
        subject: subject,
        html: html,
      });
      console.log("Email sent via Resend (Response):", response);

      if (response.error) {
        throw new Error(`Resend Error: ${response.error.message || JSON.stringify(response.error)}`);
      }

      return response.data;
    }

    // OPTION C: Gmail SMTP
    // OPTION C: Gmail SMTP
    if (provider === 'gmail') {
      console.log("Using Gmail SMTP...");
      const info = await gmailTransporter.sendMail({
        from: `"Google Drive Clone" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
      });
      console.log("Email sent via Gmail: %s", info.messageId);
      return info;
    }

    // OPTION D: Brevo SMTP
    if (provider === 'brevo-smtp') {
      if (!process.env.BREVO_SMTP_KEY) throw new Error("BREVO_SMTP_KEY is missing but provider is set to 'brevo-smtp'");

      console.log("Using Brevo SMTP...");
      const brevoTransporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 2525, // Try 2525 (Alternative port)
        secure: false, // Use STARTTLS
        auth: {
          user: process.env.BREVO_SMTP_USER, // Specific Brevo SMTP login
          pass: process.env.BREVO_SMTP_KEY
        }
      });

      const info = await brevoTransporter.sendMail({
        from: `"Google Drive Clone" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
      });
      console.log("Email sent via Brevo SMTP: %s", info.messageId);
      return info;
    }

    throw new Error(`Unknown or unconfigured email provider: ${provider}`);

  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = sendEmail;
