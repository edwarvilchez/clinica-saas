'use strict';

const fs = require('fs');
const path = require('path');

describe('🛡️ FASE 13: Docker Containerization, Multi-Stage Builds & Orchestration Security', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const serverDir = path.resolve(__dirname, '../../../');
  const serverDockerfile = path.join(serverDir, 'Dockerfile');
  const serverDockerignore = path.join(serverDir, '.dockerignore');
  const dockerCompose = path.join(rootDir, 'docker-compose.yml');

  describe('1. Dockerfile Multi-Stage & Base Image Hardening', () => {
    it('🔒 Verifies Dockerfile exists and uses node:20-alpine', () => {
      expect(fs.existsSync(serverDockerfile)).toBe(true);
      const content = fs.readFileSync(serverDockerfile, 'utf8');

      expect(content).toContain('node:20-alpine');
      expect(content).toContain('AS dependencies');
      expect(content).toContain('AS runner');
    });

    it('🔒 Verifies non-root execution (USER node) and unprivileged permissions', () => {
      const content = fs.readFileSync(serverDockerfile, 'utf8');

      expect(content).toMatch(/USER\s+node/);
      expect(content).toContain('chown -R node:node /usr/src/app');
    });

    it('🔒 Enforces dumb-init process manager to prevent zombie processes', () => {
      const content = fs.readFileSync(serverDockerfile, 'utf8');

      expect(content).toContain('dumb-init');
      expect(content).toContain('ENTRYPOINT ["/usr/bin/dumb-init", "--"]');
    });

    it('🔒 Configures native HEALTHCHECK targeting /health/ready', () => {
      const content = fs.readFileSync(serverDockerfile, 'utf8');

      expect(content).toContain('HEALTHCHECK');
      expect(content).toContain('/health/ready');
      expect(content).toContain('--interval=30s');
    });

    it('🔒 Prohibits copying plain-text .env file into the image layers', () => {
      const content = fs.readFileSync(serverDockerfile, 'utf8');
      // Must not contain `COPY .env .`
      expect(content).not.toMatch(/COPY\s+\.env\s+/);
    });
  });

  describe('2. .dockerignore Secret & Data Leakage Prevention', () => {
    it('🔒 Ensures .dockerignore excludes .env, node_modules, and git directories', () => {
      expect(fs.existsSync(serverDockerignore)).toBe(true);
      const content = fs.readFileSync(serverDockerignore, 'utf8');

      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
      expect(content).toContain('.git/');
      expect(content).toContain('uploads/');
      expect(content).toContain('storage/');
      expect(content).toContain('backups/');
    });
  });

  describe('3. Docker Compose Orchestration & Network Segmentation', () => {
    it('🔒 Verifies coordinated healthchecks (condition: service_healthy)', () => {
      expect(fs.existsSync(dockerCompose)).toBe(true);
      const content = fs.readFileSync(dockerCompose, 'utf8');

      expect(content).toContain('condition: service_healthy');
      expect(content).toContain('healthcheck:');
      expect(content).toContain('pg_isready');
      expect(content).toContain('/health/ready');
    });

    it('🔒 Verifies network isolation between internal database tier and public web tier', () => {
      const content = fs.readFileSync(dockerCompose, 'utf8');

      expect(content).toContain('clinica-internal-net');
      expect(content).toContain('clinica-dmz-net');
      // DB must only be in internal network
      expect(content).toMatch(/db:[\s\S]*?clinica-internal-net/);
    });

    it('🔒 Verifies persistent named volumes for postgres, uploads, and backups', () => {
      const content = fs.readFileSync(dockerCompose, 'utf8');

      expect(content).toContain('clinica_saas_postgres_data');
      expect(content).toContain('clinica_saas_uploads_data');
      expect(content).toContain('clinica_saas_storage_data');
      expect(content).toContain('clinica_saas_db_backups');
    });
  });
});
