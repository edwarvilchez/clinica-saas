'use strict';

/**
 * Script de Respaldo Automatizado Multi-Plataforma - Clinica SaaS
 * Soporta generación de pg_dump, cálculo de SHA-256, cifrado AES-256-CBC y purga de retención.
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
  dbPassword: process.env.DB_PASSWORD || '',
  backupDir: process.env.BACKUP_DIR || path.resolve(__dirname, '../../../backups'),
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || null
};

// Asegurar directorio de respaldo
if (!fs.existsSync(config.backupDir)) {
  fs.mkdirSync(config.backupDir, { recursive: true });
}

const formatTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const calculateSha256 = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

const encryptFile = async (inputPath, outputPath, keyString) => {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);

  // Escribir IV al inicio del archivo
  output.write(iv);

  return new Promise((resolve, reject) => {
    input.pipe(cipher).pipe(output);
    output.on('finish', () => resolve());
    output.on('error', reject);
    cipher.on('error', reject);
  });
};

const purgeOldBackups = (dir, retentionDays) => {
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(dir);
  let purgedCount = 0;

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && (now - stats.mtimeMs) > maxAgeMs) {
        fs.unlinkSync(filePath);
        purgedCount++;
      }
    } catch (e) {
      // Ignorar errores al chequear stats
    }
  });

  return purgedCount;
};

const executeBackup = async (options = {}) => {
  const targetDb = options.database || config.dbName;
  const timestamp = formatTimestamp();
  const baseName = `${targetDb}_backup_${timestamp}`;
  const dumpPath = path.join(config.backupDir, `${baseName}.dump`);

  const startTime = Date.now();
  console.log(JSON.stringify({
    level: 'info',
    msg: `Iniciando proceso de respaldo para ${targetDb}...`,
    host: config.dbHost,
    port: config.dbPort,
    database: targetDb,
    outputFile: dumpPath
  }));

  // Ejecutar pg_dump
  const env = { ...process.env, PGPASSWORD: config.dbPassword };
  const args = [
    '-h', config.dbHost,
    '-p', String(config.dbPort),
    '-U', config.dbUser,
    '-d', targetDb,
    '-Fc', // Formato custom comprimido
    '-Z', '9', // Nivel máximo compresión gzip interna
    '-f', dumpPath
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn('pg_dump', args, { env });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump falló con código ${code}: ${stderr}`));
    });
    proc.on('error', (err) => {
      reject(new Error(`No se pudo invocar pg_dump: ${err.message}`));
    });
  });

  let finalArtifactPath = dumpPath;

  // Cifrado opcional con AES-256-CBC
  const encKey = options.encryptionKey || config.encryptionKey;
  if (encKey) {
    const encPath = `${dumpPath}.enc`;
    await encryptFile(dumpPath, encPath, encKey);
    fs.unlinkSync(dumpPath); // Eliminar archivo en texto plano
    finalArtifactPath = encPath;
  }

  // Generar Checksum SHA-256
  const sha256 = await calculateSha256(finalArtifactPath);
  const sha256Path = `${finalArtifactPath}.sha256`;
  fs.writeFileSync(sha256Path, `${sha256}  ${path.basename(finalArtifactPath)}\n`, 'utf8');

  // Purgar respaldos antiguos
  const purged = purgeOldBackups(config.backupDir, config.retentionDays);
  const durationMs = Date.now() - startTime;
  const stats = fs.statSync(finalArtifactPath);

  const result = {
    status: 'SUCCESS',
    database: targetDb,
    artifactPath: finalArtifactPath,
    checksumPath: sha256Path,
    sha256,
    sizeBytes: stats.size,
    isEncrypted: !!encKey,
    purgedOldFiles: purged,
    durationMs
  };

  console.log(JSON.stringify({
    level: 'info',
    msg: 'Respaldo completado exitosamente',
    ...result
  }));

  return result;
};

// Si se ejecuta directamente desde la línea de comandos
if (require.main === module) {
  executeBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(JSON.stringify({ level: 'error', message: err.message }));
      process.exit(1);
    });
}

module.exports = {
  executeBackup,
  calculateSha256,
  encryptFile,
  purgeOldBackups
};
