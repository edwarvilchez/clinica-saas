const crypto = require('crypto');

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let hex = '';
  const cleanBase32 = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  for (let i = 0; i < cleanBase32.length; i++) {
    const val = alphabet.indexOf(cleanBase32.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.substr(i, 8), 2).toString(16).padStart(2, '0');
  }
  return Buffer.from(hex, 'hex');
}

function generateSecret(length = 20) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += alphabet[bytes[i] % 32];
  }
  return secret;
}

function generateTOTP(secret, timeWindow = null) {
  const key = base32Decode(secret);
  const epoch = Math.floor((timeWindow || Date.now()) / 1000);
  const time = Buffer.alloc(8);
  time.writeBigInt64BE(BigInt(Math.floor(epoch / 30)));

  const hmac = crypto.createHmac('sha1', key).update(time).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

function verifyTOTP(secret, token, window = 1) {
  if (!secret || !token) return false;
  const cleanToken = token.toString().trim();
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const time = now + (i * 30000);
    if (generateTOTP(secret, time) === cleanToken) {
      return true;
    }
  }
  return false;
}

function getQRCodeUrl(email, secret, issuer = 'MedicalCare888') {
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
  return { otpauthUrl, qrImageUrl };
}

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  getQRCodeUrl
};
