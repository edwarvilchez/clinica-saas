const { Resend } = require('resend');
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const isResendActive = !!process.env.RESEND_API_KEY;
  const fromName = process.env.FROM_NAME || 'Clinica - SaaS';
  const fromEmail = process.env.FROM_EMAIL || 'no-reply@clinicasaas.com';

  console.log(`📨 Attempting to send email via ${isResendActive ? 'Resend SDK' : 'Nodemailer SMTP'}`);

  try {
    if (isResendActive) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: Array.isArray(options.email) ? options.email : [options.email],
        subject: options.subject,
        html: options.html,
        text: options.message || ''
      });

      if (error) {
        throw new Error(`Resend Error: ${error.message}`);
      }

      console.log(`✅ Email sent via Resend: ${data.id}`);
      return data;

    } else {
      // Fallback: Nodemailer SMTP (requires SMTP_HOST, EMAIL, PASSWORD)
      if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
        throw new Error('Email credentials (Resend or SMTP) missing in environment');
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD
        }
      });

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent via Nodemailer to ${options.email}`);
    }

  } catch (error) {
    console.warn(`⚠️ Email delivery failed: ${error.message}`);
    // Simulate/Log for developers
    console.log('📨  [SIMULATED EMAIL LOG]');
    console.log(`    To: ${options.email}`);
    console.log(`    Subject: ${options.subject}`);
    
    // In production, we don't want to break the entire app if email fails (unless it's critical).
    // For now, we throw the error so the calling controller can handle it.
    throw error;
  }
};

module.exports = sendEmail;
