'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { calculateSha256, encryptFile, purgeOldBackups } = require('../../scripts/backup-db');
const { verifySha256, decryptFile } = require('../../scripts/restore-db');

describe('🛡️ FASE 12: Backup Strategy, Cryptographic Integrity & Disaster Recovery', () => {
  const testDir = path.resolve(__dirname, '../../../../test_scratch_backups');
  const dummyDumpPath = path.join(testDir, 'sample_clinica_test.dump');
  const encryptedDumpPath = path.join(testDir, 'sample_clinica_test.dump.enc');
  const decryptedDumpPath = path.join(testDir, 'sample_clinica_test_restored.dump');
  const checksumPath = path.join(testDir, 'sample_clinica_test.dump.enc.sha256');

  const testSecretKey = 'TestBackupSecretEncryptionKey32Chars!';
  const dummyDbPayload = 'PostgreSQL Dump Payload with Patient and Tenant Records: ' + crypto.randomBytes(128).toString('hex');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(dummyDumpPath, dummyDbPayload, 'utf8');
  });

  afterAll(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (err) {
      // Best effort cleanup
    }
  });

  describe('1. Cifrado Simétrico y Descifrado (AES-256-CBC)', () => {
    it('🔒 Cifra correctamente el dump de base de datos impidiendo lectura en texto plano', async () => {
      await encryptFile(dummyDumpPath, encryptedDumpPath, testSecretKey);

      expect(fs.existsSync(encryptedDumpPath)).toBe(true);

      const encryptedContent = fs.readFileSync(encryptedDumpPath);
      // El contenido cifrado no debe contener texto plano
      expect(encryptedContent.includes(Buffer.from('PostgreSQL Dump Payload'))).toBe(false);
      expect(encryptedContent.length).toBeGreaterThan(16); // IV + payload
    });

    it('🔒 Descifra el artefacto recuperando la integridad exacta de los datos originales', async () => {
      await decryptFile(encryptedDumpPath, decryptedDumpPath, testSecretKey);

      expect(fs.existsSync(decryptedDumpPath)).toBe(true);
      const restoredContent = fs.readFileSync(decryptedDumpPath, 'utf8');
      expect(restoredContent).toBe(dummyDbPayload);
    });

    it('🔒 Falla de forma segura si la clave de descifrado es incorrecta', async () => {
      const badDecryptedPath = path.join(testDir, 'bad_restore.dump');
      const wrongKey = 'WrongEncryptionKeyInvalidLength123';

      await expect(
        decryptFile(encryptedDumpPath, badDecryptedPath, wrongKey)
      ).rejects.toThrow();
    });
  });

  describe('2. Verificación Criptográfica de Integridad (SHA-256 Checksum)', () => {
    it('🔒 Calcula y valida exitosamente el checksum SHA-256 de un respaldo auténtico', async () => {
      const sha256 = await calculateSha256(encryptedDumpPath);
      fs.writeFileSync(checksumPath, `${sha256}  sample_clinica_test.dump.enc\n`, 'utf8');

      const isValid = await verifySha256(encryptedDumpPath, checksumPath);
      expect(isValid).toBe(true);
    });

    it('🚨 DETECTA ALTERACIÓN: Rechaza el respaldo si fue manipulado o corrompido', async () => {
      const tamperedPath = path.join(testDir, 'tampered_backup.dump.enc');
      const tamperedChecksumPath = path.join(testDir, 'tampered_backup.dump.enc.sha256');

      // Crear archivo legítimo
      const legitimateHash = await calculateSha256(encryptedDumpPath);
      fs.copyFileSync(encryptedDumpPath, tamperedPath);
      fs.writeFileSync(tamperedChecksumPath, `${legitimateHash}  tampered_backup.dump.enc\n`, 'utf8');

      // Manipular un solo byte del archivo cifrado (simular corrupción de disco o ataque MITM)
      const buffer = fs.readFileSync(tamperedPath);
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 0xFF; // Invertir bits
      fs.writeFileSync(tamperedPath, buffer);

      // La verificación debe fallar inmediatamente
      await expect(
        verifySha256(tamperedPath, tamperedChecksumPath)
      ).rejects.toThrow(/Integridad violada/);
    });
  });

  describe('3. Política de Retención y Purga de Respaldos Antiguos', () => {
    it('🔒 Purga archivos que excedan la ventana de retención y conserva los recientes', () => {
      const retentionDir = path.join(testDir, 'retention_test');
      fs.mkdirSync(retentionDir, { recursive: true });

      const recentFile = path.join(retentionDir, 'backup_today.dump');
      const oldFile = path.join(retentionDir, 'backup_old.dump');

      fs.writeFileSync(recentFile, 'recent data');
      fs.writeFileSync(oldFile, 'old data');

      // Forzar fecha de modificación a 40 días en el pasado para oldFile
      const fortyDaysAgo = new Date(Date.now() - (40 * 24 * 60 * 60 * 1000));
      fs.utimesSync(oldFile, fortyDaysAgo, fortyDaysAgo);

      // Purgar con retención de 30 días
      const purged = purgeOldBackups(retentionDir, 30);

      expect(purged).toBe(1);
      expect(fs.existsSync(recentFile)).toBe(true);
      expect(fs.existsSync(oldFile)).toBe(false);
    });
  });

  describe('4. Verificación de Artefactos de Documentación y Runbooks', () => {
    it('🔒 Verifica la existencia de BACKUP_STRATEGY.md con métricas RPO/RTO y regla 3-2-1', () => {
      const strategyPath = path.resolve(__dirname, '../../../../BACKUP_STRATEGY.md');
      expect(fs.existsSync(strategyPath)).toBe(true);

      const content = fs.readFileSync(strategyPath, 'utf8');
      expect(content).toContain('RPO (Recovery Point Objective)');
      expect(content).toContain('RTO (Recovery Time Objective)');
      expect(content).toContain('Regla 3-2-1');
      expect(content).toContain('pg_dump');
    });

    it('🔒 Verifica la existencia de DISASTER_RECOVERY.md con runbook paso a paso', () => {
      const drpPath = path.resolve(__dirname, '../../../../DISASTER_RECOVERY.md');
      expect(fs.existsSync(drpPath)).toBe(true);

      const content = fs.readFileSync(drpPath, 'utf8');
      expect(content).toContain('SEV-1');
      expect(content).toContain('pg_restore');
      expect(content).toContain('sha256sum');
      expect(content).toContain('Runbook');
    });
  });
});
