const { Organization, Doctor, Appointment, User } = require('../models');
const { Op } = require('sequelize');

const PLAN_LIMITS = {
  PROFESSIONAL: {
    maxDoctors: 2,
    maxAppointmentsPerMonth: 100
  },
  CLINIC: {
    maxDoctors: 15,
    maxAppointmentsPerMonth: 1000
  },
  HOSPITAL: {
    maxDoctors: Infinity,
    maxAppointmentsPerMonth: Infinity
  }
};

const isExempt = (req) => {
  if (!req.user) return false;
  if (req.user.role === 'SUPERADMIN' || req.user.role === 'PLATFORM_ADMIN') return true;
  if (req.user.subscriptionBypass) return true;
  return false;
};

const checkSubscriptionActive = async (req, res, next) => {
  try {
    if (isExempt(req)) return next();
    if (!req.user.organizationId) return next();

    const org = await Organization.findByPk(req.user.organizationId);
    if (!org) return next();

    if (['PAST_DUE', 'CANCELLED'].includes(org.subscriptionStatus)) {
      return res.status(403).json({
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Tu suscripción ha vencido o está en estado pendiente de pago. Por favor regulariza tu plan para continuar registrando información.',
        subscriptionStatus: org.subscriptionStatus
      });
    }

    next();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    next();
  }
};

const checkDoctorQuota = async (req, res, next) => {
  try {
    if (isExempt(req)) return next();
    if (!req.user.organizationId) return next();

    const org = await Organization.findByPk(req.user.organizationId);
    if (!org) return next();

    const planType = org.type || 'PROFESSIONAL';
    const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.PROFESSIONAL;

    if (limits.maxDoctors === Infinity) return next();

    const currentDoctorsCount = await Doctor.count({
      where: { organizationId: org.id }
    });

    if (currentDoctorsCount >= limits.maxDoctors) {
      return res.status(403).json({
        error: 'UPGRADE_REQUIRED',
        message: `Has alcanzado el límite máximo de doctores (${limits.maxDoctors}) permitidos por tu plan ${planType}. Actualiza a un plan superior para continuar agregando personal médico.`,
        currentCount: currentDoctorsCount,
        limit: limits.maxDoctors,
        planType
      });
    }

    next();
  } catch (error) {
    console.error('Error checking doctor quota:', error);
    next();
  }
};

const checkAppointmentQuota = async (req, res, next) => {
  try {
    if (isExempt(req)) return next();
    if (!req.user.organizationId) return next();

    const org = await Organization.findByPk(req.user.organizationId);
    if (!org) return next();

    const planType = org.type || 'PROFESSIONAL';
    const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.PROFESSIONAL;

    if (limits.maxAppointmentsPerMonth === Infinity) return next();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Count appointments created this month for doctors in this organization
    const doctors = await Doctor.findAll({
      where: { organizationId: org.id },
      attributes: ['id']
    });

    const doctorIds = doctors.map(d => d.id);
    if (doctorIds.length === 0) return next();

    const monthlyAppointmentsCount = await Appointment.count({
      where: {
        doctorId: { [Op.in]: doctorIds },
        createdAt: { [Op.between]: [startOfMonth, endOfMonth] }
      }
    });

    if (monthlyAppointmentsCount >= limits.maxAppointmentsPerMonth) {
      return res.status(403).json({
        error: 'UPGRADE_REQUIRED',
        message: `Has alcanzado la cuota máxima de citas mensuales (${limits.maxAppointmentsPerMonth}) permitidas por tu plan ${planType}. Actualiza a un plan superior para continuar reservando citas.`,
        currentCount: monthlyAppointmentsCount,
        limit: limits.maxAppointmentsPerMonth,
        planType
      });
    }

    next();
  } catch (error) {
    console.error('Error checking appointment quota:', error);
    next();
  }
};

module.exports = {
  PLAN_LIMITS,
  checkSubscriptionActive,
  checkDoctorQuota,
  checkAppointmentQuota
};
