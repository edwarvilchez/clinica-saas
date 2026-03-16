const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === 'SSL' || parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  const path = require('path');
  const logoPath = path.join(__dirname, '../assets/logo.png');

  // 2. Define the email options
  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'Medicus APP'}" <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
    attachments: [
      {
        filename: 'logo.png',
        path: logoPath,
        cid: 'logo_medicus' // same cid value as in the html img src
      }
    ]
  };

  // 3. Try to send, fallback to simulation on ANY error
  try {
    // If explicitly missing credentials, throw immediately to go to catch
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      throw new Error('SMTP credentials missing');
    }

    await transporter.verify(); // Verify connection first
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent officially to ${options.email}`);

  } catch (error) {
    console.warn(`⚠️  Email delivery failed (${error.message}). Falling back to SIMULATION MODE.`);
    console.log('📨  [SIMULATED EMAIL FALLBACK - CHECK LOGS]');
    console.log(`    To: ${options.email}`);
    console.log(`    Subject: ${options.subject}`);
    console.log(`    Message Preview: ${options.message ? options.message.substring(0, 150) : 'No text content'}`);

    // In production, we might want to log this to a file or monitoring service
    // Throw the error so the app flow (like "Forgot Password") knows it failed
    // and doesn't silently ignore the email failure.
    throw error;
  }
};

module.exports = sendEmail;
