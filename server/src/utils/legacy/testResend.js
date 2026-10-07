const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const sendEmail = require('./sendEmail');

async function testResend() {
  console.log('--- Testing Resend Integration ---');
  console.log(`Using API Key: ${process.env.RESEND_API_KEY ? 'Present (OK)' : 'Missing (ERR)'}`);
  console.log(`From Name: ${process.env.FROM_NAME}`);
  console.log(`From Email: ${process.env.FROM_EMAIL}`);

  try {
    const result = await sendEmail({
      email: 'admin@clinica-saas.com', // Change this to your personal email for the test
      subject: '🚀 Prueba de Resend - Clínica SaaS',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h1>¡Prueba de Resend Exitosa!</h1>
          <p>Este es un correo de prueba enviado desde el sistema de <strong>Clínica SaaS</strong> usando la infraestructura de <strong>Resend SDK</strong>.</p>
          <hr>
          <p style="font-size: 12px; color: #666;">Enviado el ${new Date().toLocaleString()}</p>
        </div>
      `,
      message: 'Este es el texto plano de la prueba de Resend.'
    });

    console.log('✅ Test finished successfully!');
    if (result) console.log('Result Data:', result);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testResend();
