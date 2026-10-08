'use strict';

const sequelize = require('../config/db.config');
const fileStorageService = require('./fileStorage.service');
const appConfig = require('../config/app.config');
const pkg = require('../../package.json');

class HealthService {
  /**
   * 💓 Liveness Probe
   * Indicates whether the Node.js process is active, responding and not deadlocked.
   * Kubernetes / ECS restarts the container if this check fails.
   */
  getLiveness() {
    const memory = process.memoryUsage();

    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      service: 'clinica-saas-server',
      version: pkg.version || '4.3.13',
      environment: appConfig.env,
      memory: {
        heapUsedMB: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((memory.rss / 1024 / 1024) * 100) / 100
      }
    };
  }

  /**
   * 🔍 PostgreSQL Readiness Check
   * Executes a lightweight ping query with a 3-second hard timeout.
   */
  async checkDatabaseHealth() {
    const start = Date.now();
    try {
      await sequelize.query('SELECT 1 AS alive;', {
        timeout: 3000,
        type: sequelize.QueryTypes.SELECT
      });
      const latencyMs = Date.now() - start;
      return {
        status: 'UP',
        latencyMs,
        database: appConfig.database.name
      };
    } catch (err) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        error: err.message
      };
    }
  }

  /**
   * 📁 Secure Storage Readiness Check
   * Verifies access and write permissions to the private storage backend.
   */
  async checkStorageHealth() {
    return await fileStorageService.checkHealth();
  }

  /**
   * ⚡ Optional Cache / Queue Readiness Check (Redis)
   * Only active if REDIS_URL or REDIS_HOST is configured in environment.
   */
  async checkRedisHealth() {
    const redisHost = process.env.REDIS_HOST || process.env.REDIS_URL;
    if (!redisHost) {
      return {
        status: 'DISABLED',
        message: 'Redis cache is not configured in current deployment mode'
      };
    }

    try {
      // If ioredis is installed and configured
      const Redis = require('ioredis');
      const redis = new Redis(redisHost, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true
      });
      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();

      return {
        status: pong === 'PONG' ? 'UP' : 'DOWN'
      };
    } catch (err) {
      return {
        status: 'DOWN',
        error: err.message
      };
    }
  }

  /**
   * 🎯 Readiness Probe
   * Validates active connectivity to critical backends (PostgreSQL and Storage).
   * Orchestrators and load balancers route traffic ONLY when readiness reports 200 / READY.
   */
  async getReadiness() {
    const timestamp = new Date().toISOString();

    const [dbHealth, storageHealth, redisHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkStorageHealth(),
      this.checkRedisHealth()
    ]);

    // Critical dependencies: Database & Storage must be UP
    const isDbUp = dbHealth.status === 'UP';
    const isStorageUp = storageHealth.status === 'UP';
    // Redis is non-blocking if disabled or optional
    const isRedisHealthy = redisHealth.status !== 'DOWN';

    const isReady = isDbUp && isStorageUp && isRedisHealthy;

    const report = {
      status: isReady ? 'READY' : 'NOT_READY',
      isReady,
      timestamp,
      version: pkg.version || '4.3.13',
      environment: appConfig.env,
      checks: {
        database: dbHealth,
        storage: storageHealth,
        cache: redisHealth
      }
    };

    return {
      statusCode: isReady ? 200 : 503,
      report
    };
  }
}

module.exports = new HealthService();
