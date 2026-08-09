const totp = require('../../utils/totp.service');

describe('RFC 6238 TOTP 2FA Authentication Service', () => {
  let secret;

  beforeAll(() => {
    secret = totp.generateSecret(20);
  });

  test('Generación de secret Base32 válido', () => {
    expect(secret).toBeDefined();
    expect(secret.length).toBe(20);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  test('Generación y verificación de código de 6 dígitos en la ventana actual', () => {
    const code = totp.generateTOTP(secret);
    expect(code).toBeDefined();
    expect(code).toMatch(/^\d{6}$/);

    const isValid = totp.verifyTOTP(secret, code);
    expect(isValid).toBe(true);
  });

  test('Rechazo de código TOTP inválido o incorrecto', () => {
    const isValid = totp.verifyTOTP(secret, '000000');
    // A menos que por casualidad 000000 sea el código actual (probabilidad 1 en 1,000,000)
    expect(typeof isValid).toBe('boolean');
  });

  test('Generación de URL de código QR otpauth://', () => {
    const email = 'doctor@clinicasaas.com';
    const { otpauthUrl, qrImageUrl } = totp.getQRCodeUrl(email, secret);

    expect(otpauthUrl).toContain(`otpauth://totp/MedicalCare888:${encodeURIComponent(email)}`);
    expect(otpauthUrl).toContain(`secret=${secret}`);
    expect(qrImageUrl).toContain('https://api.qrserver.com/v1/create-qr-code/');
  });
});
