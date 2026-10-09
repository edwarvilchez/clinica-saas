'use strict';

/**
 * Script de Restauración y Verificación de Integridad de Respaldo - Clinica SaaS
 * Soporta verificación SHA-256, descifrado AES-256-CBC e invocación de pg_restore.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbPort: process.env.DB_PORT || '5432',
  dbName: process.env.DB_NAME || 'clinica_saas_bd',
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || ''
};

const resolvePgBinary = (binName) => {
  if (process.env.PG_BIN_PATH) {
    const candidate = path.join(process.env.PG_BIN_PATH, binName + (process.platform === 'win32' ? '.exe' : ''));
    if (fs.existsSync(candidate)) return candidate;
  }
  if (process.platform === 'win32') {
    const defaultWinPaths = [
      'C:\\Program Files\\PostgreSQL\\16\\bin',
      'C:\\Program Files\\PostgreSQL\\15\\bin',
      'C:\\Program Files\\PostgreSQL\\14\\bin',
      'C:\\Program Files\\PostgreSQL\\13\\bin'
    ];
    for (const p of defaultWinPaths) {
      const candidate = path.join(p, `${binName}.exe`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return binName;
};

const verifySha256 = async (filePath, checksumFilePath) => {
  if (!fs.existsSync(checksumFilePath)) {
    throw new Error(`Archivo de verificación checksum no encontrado: ${checksumFilePath}`);
  }

  const expectedContent = fs.readFileSync(checksumFilePath, 'utf8').trim();
  const expectedHash = expectedContent.split(/\s+/)[0];

  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const actualHash = hash.digest('hex');
  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(`Integridad violada: Hash esperado '${expectedHash}', pero se calculó '${actualHash}'`);
  }

  return true;
};

const decryptFile = async (encryptedPath, decryptedPath, keyString) => {
  const fileBuffer = await fs.promises.readFile(encryptedPath);
  if (fileBuffer.length < 16) {
    throw new Error('Archivo cifrado inválido: longitud insuficiente para vector de inicialización IV.');
  }

  const iv = fileBuffer.subarray(0, 16);
  const ciphertext = fileBuffer.subarray(16);
  const key = crypto.createHash('sha256').update(keyString).digest();

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  await fs.promises.writeFile(decryptedPath, decrypted);
  return decryptedPath;
};

const executeRestore = async (options = {}) => {
  const filePath = options.file;
  const targetDb = options.database || config.dbName;
  const encryptionKey = options.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY;

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`El archivo de respaldo especificado no existe: ${filePath}`);
  }

  // 1. Verificación de Checksum si existe .sha256
  const sha256Path = `${filePath}.sha256`;
  if (fs.existsSync(sha256Path)) {
    console.log(`[INFO] Verificando firma criptográfica SHA-256 de ${filePath}...`);
    await verifySha256(filePath, sha256Path);
    console.log(`[OK] Integridad verificada satisfactoriamente.`);
  }

  let fileToRestore = filePath;
  let tempDecryptedPath = null;

  // 2. Descifrado si el archivo tiene extensión .enc
  if (filePath.endsWith('.enc')) {
    if (!encryptionKey) {
      throw new Error('El respaldo está cifrado pero no se suministró BACKUP_ENCRYPTION_KEY.');
    }
    tempDecryptedPath = path.join(path.dirname(filePath), `temp_restore_${Date.now()}.dump`);
    console.log(`[INFO] Descifrando respaldo AES-256-CBC hacia ${tempDecryptedPath}...`);
    await decryptFile(filePath, tempDecryptedPath, encryptionKey);
    fileToRestore = tempDecryptedPath;
  }

  // 3. Ejecutar pg_restore
  try {
    console.log(`[INFO] Restaurando en PostgreSQL '${targetDb}'...`);
    const env = { ...process.env, PGPASSWORD: config.dbPassword };
    const args = [
      '-h', config.dbHost,
      '-p', String(config.dbPort),
      '-U', config.dbUser,
      '-d', targetDb,
      '--clean',
      '--if-exists',
      '--no-owner',
      fileToRestore
    ];

    await new Promise((resolve, reject) => {
      const pgRestoreExecutable = resolvePgBinary('pg_restore');
      const proc = spawn(pgRestoreExecutable, args, { env });
      let stderr = '';
      proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
      proc.on('close', code => {
        // En pg_restore, el código 0 es éxito total y el código 1 suele ser advertencias menores
        if (code === 0 || code === 1) resolve();
        else reject(new Error(`pg_restore falló con código ${code}: ${stderr}`));
      });
      proc.on('error', err => {
        reject(new Error(`No se pudo invocar pg_restore: ${err.message}`));
      });
    });

    console.log(`[OK] Restauración completada exitosamente en la base de datos '${targetDb}'.`);
    return { status: 'SUCCESS', database: targetDb };
  } finally {
    if (tempDecryptedPath && fs.existsSync(tempDecryptedPath)) {
      fs.unlinkSync(tempDecryptedPath);
    }
  }
};

module.exports = {
  executeRestore,
  verifySha256,
  decryptFile
};

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node restore-db.js <ruta_del_archivo_dump>');
    process.exit(1);
  }
  executeRestore({ file: filePath })
    .then((res) => {
      console.log('Resultado:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error durante la restauración:', err.message);
      process.exit(1);
    });
}
