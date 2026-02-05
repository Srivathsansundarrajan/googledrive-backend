require('dotenv').config();
const sendEmail = require('./utils/sendEmail');

const verify = async () => {
    console.log("Starting verification...");
    try {
        await sendEmail({
            to: process.env.EMAIL_USER || 'srivathsanns154@gmail.com',
            subject: 'Test Email from SendGrid',
            html: '<h1>It works!</h1><p>This is a test email sent via SendGrid integration.</p>'
        });
        console.log("Verification SUCCESS!");
    } catch (error) {
        console.error("Verification FAILED:");
        if (error.response) {
            console.error(JSON.stringify(error.response.body, null, 2));
        } else {
            console.error(error);
        }
    }
};

verify();
