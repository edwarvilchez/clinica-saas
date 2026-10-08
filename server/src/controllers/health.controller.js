'use strict';

const healthService = require('../services/health.service');

/**
 * 💓 Liveness probe endpoint
 * GET /health/live
 */
exports.live = (req, res) => {
  const liveness = healthService.getLiveness();
  res.status(200).json(liveness);
};

/**
 * 🎯 Readiness probe endpoint
 * GET /health/ready
 */
exports.ready = async (req, res) => {
  try {
    const { statusCode, report } = await healthService.getReadiness();
    res.status(statusCode).json(report);
  } catch (error) {
    res.status(503).json({
      status: 'NOT_READY',
      isReady: false,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * 📋 Canary / Summary endpoint (backward compatible with /api/health)
 * GET /health
 */
exports.summary = async (req, res) => {
  try {
    const liveness = healthService.getLiveness();
    const { statusCode, report } = await healthService.getReadiness();

    res.status(statusCode).json({
      ...liveness,
      readiness: report
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
};
