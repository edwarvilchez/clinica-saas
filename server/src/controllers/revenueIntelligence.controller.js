'use strict';

/**
 * ⚡ RevenueIntelligenceController - HTTP Endpoints for Clinical Financial Intelligence
 */

const revenueIntelligenceService = require('../services/revenueIntelligence.service');

exports.getRevenueAnalytics = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query.organizationId || req.user?.organizationId) : req.user?.organizationId;

    const { startDate, endDate, method, currency, paymentType } = req.query;

    const data = await revenueIntelligenceService.getRevenueAnalytics({
      organizationId,
      startDate,
      endDate,
      method,
      currency,
      paymentType,
      actorUserId: req.user?.id,
      ip: req.ip
    });

    res.json(data);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getRevenueTrends = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query.organizationId || req.user?.organizationId) : req.user?.organizationId;

    const { startDate, endDate, interval } = req.query;

    const data = await revenueIntelligenceService.getRevenueTrends({
      organizationId,
      startDate,
      endDate,
      interval: interval === 'monthly' ? 'monthly' : 'daily'
    });

    res.json(data);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getDoctorPayoutsLiability = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query.organizationId || req.user?.organizationId) : req.user?.organizationId;

    const { status, doctorId } = req.query;

    const data = await revenueIntelligenceService.getDoctorPayoutsLiability({
      organizationId,
      status,
      doctorId
    });

    res.json(data);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.exportRevenueReport = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query.organizationId || req.user?.organizationId) : req.user?.organizationId;

    const { startDate, endDate } = req.query;

    const report = await revenueIntelligenceService.exportRevenueReport({
      organizationId,
      startDate,
      endDate,
      actorUserId: req.user?.id,
      ip: req.ip
    });

    res.json(report);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};
