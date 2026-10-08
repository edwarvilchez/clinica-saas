'use strict';

/**
 * 📊 RevenueIntelligenceService - Clinical Financial Analytics & Revenue Segregation
 * Implements Phase 22: Multi-tenant gross/net revenue analytics, bimonetary metrics (USD/VES),
 * payment method distribution, doctor liability payouts, and specialty revenue segregation
 * without crossing clinical permissions or leaking PHI.
 */

const { Op } = require('sequelize');
const {
  Payment,
  DoctorFee,
  Doctor,
  Specialty,
  Appointment,
  Patient,
  User,
  sequelize
} = require('../models');
const auditService = require('./audit.service');
const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
const logger = require('../utils/logger');

class RevenueIntelligenceService {
  /**
   * Helper to format numbers safely to 2 decimals
   */
  _round(num) {
    return parseFloat((Number(num) || 0).toFixed(2));
  }

  /**
   * Main revenue intelligence analytics aggregator
   */
  async getRevenueAnalytics({
    organizationId = null,
    startDate = null,
    endDate = null,
    method = null,
    currency = null,
    paymentType = null,
    actorUserId = null,
    ip = null
  } = {}) {
    // 1. Build payment query filter
    const paymentWhere = {
      status: 'Paid'
    };

    if (organizationId) paymentWhere.organizationId = organizationId;
    if (method) paymentWhere.method = method;
    if (currency) paymentWhere.currency = currency;
    if (paymentType) paymentWhere.paymentType = paymentType;

    if (startDate && endDate) {
      paymentWhere.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      paymentWhere.createdAt = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      paymentWhere.createdAt = {
        [Op.lte]: new Date(endDate)
      };
    }

    // 2. Fetch paid payments with associations (excluding PHI details)
    const paidPayments = await Payment.findAll({
      where: paymentWhere,
      include: [
        {
          model: Appointment,
          attributes: ['id', 'date', 'status', 'doctorId'],
          include: [
            {
              model: Doctor,
              attributes: ['id', 'specialtyId'],
              include: [
                { model: Specialty, attributes: ['id', 'name', 'code'] },
                { model: User, attributes: ['id', 'firstName', 'lastName'] }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // 3. Query pending / uncollected payments within same scope
    const pendingWhere = {
      status: 'Pending'
    };
    if (organizationId) pendingWhere.organizationId = organizationId;
    if (startDate && endDate) {
      pendingWhere.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const pendingPayments = await Payment.findAll({
      where: pendingWhere,
      attributes: ['id', 'amount', 'currency', 'amountBs']
    });

    let uncollectedRevenueUSD = 0;
    let uncollectedRevenueVES = 0;
    for (const p of pendingPayments) {
      uncollectedRevenueUSD += parseFloat(p.amount || 0);
      uncollectedRevenueVES += parseFloat(p.amountBs || 0);
    }

    // 4. Aggregate financial totals
    let grossRevenueUSD = 0;
    let grossRevenueVES = 0;
    let totalDoctorFeesUSD = 0;
    let totalClinicFeesUSD = 0;
    let totalPharmacyDiscountsUSD = 0;

    const methodMap = {};
    const serviceTypeMap = {};
    const specialtyMap = {};

    for (const p of paidPayments) {
      const amountUSD = parseFloat(p.amount || 0);
      const amountBs = parseFloat(p.amountBs || 0);
      const docFee = parseFloat(p.doctorFeeAmount || 0);
      const clinicFee = parseFloat(p.clinicFeeAmount || 0);
      const pharmDiscount = parseFloat(p.pharmacyDiscount || 0);

      grossRevenueUSD += amountUSD;
      grossRevenueVES += amountBs;
      totalDoctorFeesUSD += docFee;
      totalClinicFeesUSD += clinicFee;
      totalPharmacyDiscountsUSD += pharmDiscount;

      // Breakdown by Payment Method
      const mKey = p.method || 'Other';
      if (!methodMap[mKey]) {
        methodMap[mKey] = { method: mKey, totalUSD: 0, totalVES: 0, count: 0 };
      }
      methodMap[mKey].totalUSD += amountUSD;
      methodMap[mKey].totalVES += amountBs;
      methodMap[mKey].count += 1;

      // Breakdown by Service / Payment Type
      const sKey = p.paymentType || 'APPOINTMENT';
      if (!serviceTypeMap[sKey]) {
        serviceTypeMap[sKey] = { serviceType: sKey, totalUSD: 0, count: 0 };
      }
      serviceTypeMap[sKey].totalUSD += amountUSD;
      serviceTypeMap[sKey].count += 1;

      // Breakdown by Specialty
      const specName = p.Appointment?.Doctor?.Specialty?.name || 'General / Sin Especialidad';
      if (!specialtyMap[specName]) {
        specialtyMap[specName] = { specialty: specName, totalUSD: 0, count: 0 };
      }
      specialtyMap[specName].totalUSD += amountUSD;
      specialtyMap[specName].count += 1;
    }

    // 5. Query Doctor Fees Liability
    const feeWhere = {};
    if (organizationId) feeWhere.organizationId = organizationId;
    if (startDate && endDate) {
      feeWhere.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const doctorFees = await DoctorFee.findAll({
      where: feeWhere,
      attributes: ['id', 'status', 'netPayableUSD', 'clinicAmountUSD', 'retentionIslrUSD']
    });

    let pendingDoctorPayoutsUSD = 0;
    let settledDoctorPayoutsUSD = 0;
    let totalRetentionIslrUSD = 0;

    for (const f of doctorFees) {
      const payable = parseFloat(f.netPayableUSD || 0);
      const retention = parseFloat(f.retentionIslrUSD || 0);
      totalRetentionIslrUSD += retention;

      if (f.status === 'PAID') {
        settledDoctorPayoutsUSD += payable;
      } else if (f.status === 'PENDING' || f.status === 'RECONCILED' || f.status === 'SETTLED') {
        pendingDoctorPayoutsUSD += payable;
      }
    }

    // 6. Net Operating Calculations
    grossRevenueUSD = this._round(grossRevenueUSD);
    grossRevenueVES = this._round(grossRevenueVES);
    totalDoctorFeesUSD = this._round(totalDoctorFeesUSD);
    totalClinicFeesUSD = this._round(totalClinicFeesUSD);
    totalPharmacyDiscountsUSD = this._round(totalPharmacyDiscountsUSD);

    const netOperatingRevenueUSD = this._round(grossRevenueUSD - totalDoctorFeesUSD - totalPharmacyDiscountsUSD);
    const operatingMarginPercentage = grossRevenueUSD > 0
      ? this._round((netOperatingRevenueUSD / grossRevenueUSD) * 100)
      : 0;

    const paidCount = paidPayments.length;
    const averageTicketUSD = paidCount > 0 ? this._round(grossRevenueUSD / paidCount) : 0;

    // Format breakdowns with percentages
    const revenueByPaymentMethod = Object.values(methodMap).map(m => ({
      ...m,
      totalUSD: this._round(m.totalUSD),
      totalVES: this._round(m.totalVES),
      percentageOfGross: grossRevenueUSD > 0 ? this._round((m.totalUSD / grossRevenueUSD) * 100) : 0
    })).sort((a, b) => b.totalUSD - a.totalUSD);

    const revenueByServiceType = Object.values(serviceTypeMap).map(s => ({
      ...s,
      totalUSD: this._round(s.totalUSD),
      percentageOfGross: grossRevenueUSD > 0 ? this._round((s.totalUSD / grossRevenueUSD) * 100) : 0
    })).sort((a, b) => b.totalUSD - a.totalUSD);

    const revenueBySpecialty = Object.values(specialtyMap).map(sp => ({
      ...sp,
      totalUSD: this._round(sp.totalUSD),
      percentageOfGross: grossRevenueUSD > 0 ? this._round((sp.totalUSD / grossRevenueUSD) * 100) : 0
    })).sort((a, b) => b.totalUSD - a.totalUSD);

    // 7. Tamper-evident Audit Log
    await auditService.logEvent({
      action: 'REVENUE_ANALYTICS_ACCESSED',
      entity: 'Payment',
      entityId: organizationId || 'GLOBAL',
      organizationId,
      actorUserId,
      newValues: {
        grossRevenueUSD,
        netOperatingRevenueUSD,
        paidTransactionsCount: paidCount,
        filterStartDate: startDate,
        filterEndDate: endDate
      },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[RevenueIntelligence] Audit log failed' }));

    // 8. Publish Domain Event
    eventBus.publish(DOMAIN_EVENTS.REVENUE_ANALYTICS_REQUESTED, {
      grossRevenueUSD,
      netOperatingRevenueUSD,
      paidCount,
      startDate,
      endDate
    }, {
      organizationId,
      userId: actorUserId
    });

    return {
      overview: {
        grossRevenueUSD,
        grossRevenueVES,
        netOperatingRevenueUSD,
        operatingMarginPercentage,
        totalDoctorFeesUSD,
        totalClinicFeesUSD,
        totalPharmacyDiscountsUSD,
        uncollectedRevenueUSD: this._round(uncollectedRevenueUSD),
        uncollectedRevenueVES: this._round(uncollectedRevenueVES),
        paidTransactionsCount: paidCount,
        pendingTransactionsCount: pendingPayments.length,
        averageTicketUSD
      },
      doctorLiabilities: {
        pendingDoctorPayoutsUSD: this._round(pendingDoctorPayoutsUSD),
        settledDoctorPayoutsUSD: this._round(settledDoctorPayoutsUSD),
        totalRetentionIslrUSD: this._round(totalRetentionIslrUSD),
        totalDoctorFeeRecords: doctorFees.length
      },
      revenueByPaymentMethod,
      revenueByServiceType,
      revenueBySpecialty
    };
  }

  /**
   * Time-series revenue trends for charting (daily or monthly buckets)
   */
  async getRevenueTrends({
    organizationId = null,
    startDate = null,
    endDate = null,
    interval = 'daily' // 'daily' | 'monthly'
  } = {}) {
    const where = { status: 'Paid' };
    if (organizationId) where.organizationId = organizationId;

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.createdAt = { [Op.lte]: new Date(endDate) };
    }

    const payments = await Payment.findAll({
      where,
      attributes: ['id', 'amount', 'amountBs', 'doctorFeeAmount', 'clinicFeeAmount', 'createdAt'],
      order: [['createdAt', 'ASC']]
    });

    const bucketMap = {};

    for (const p of payments) {
      const date = new Date(p.createdAt);
      const bucketKey = interval === 'monthly'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : date.toISOString().split('T')[0];

      if (!bucketMap[bucketKey]) {
        bucketMap[bucketKey] = {
          date: bucketKey,
          grossUSD: 0,
          grossVES: 0,
          doctorFeesUSD: 0,
          clinicFeesUSD: 0,
          netUSD: 0,
          transactionsCount: 0
        };
      }

      const amountUSD = parseFloat(p.amount || 0);
      const amountBs = parseFloat(p.amountBs || 0);
      const docFee = parseFloat(p.doctorFeeAmount || 0);
      const clinicFee = parseFloat(p.clinicFeeAmount || 0);

      bucketMap[bucketKey].grossUSD += amountUSD;
      bucketMap[bucketKey].grossVES += amountBs;
      bucketMap[bucketKey].doctorFeesUSD += docFee;
      bucketMap[bucketKey].clinicFeesUSD += clinicFee;
      bucketMap[bucketKey].netUSD += (amountUSD - docFee);
      bucketMap[bucketKey].transactionsCount += 1;
    }

    const trendPoints = Object.values(bucketMap).map(b => ({
      date: b.date,
      grossUSD: this._round(b.grossUSD),
      grossVES: this._round(b.grossVES),
      doctorFeesUSD: this._round(b.doctorFeesUSD),
      clinicFeesUSD: this._round(b.clinicFeesUSD),
      netUSD: this._round(b.netUSD),
      transactionsCount: b.transactionsCount
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      interval,
      totalPoints: trendPoints.length,
      trends: trendPoints
    };
  }

  /**
   * Detailed Doctor Payouts & Liability Schedule
   */
  async getDoctorPayoutsLiability({
    organizationId = null,
    status = null,
    doctorId = null
  } = {}) {
    const where = {};
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;

    const fees = await DoctorFee.findAll({
      where,
      include: [
        {
          model: Doctor,
          attributes: ['id', 'licenseNumber'],
          include: [
            { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
            { model: Specialty, attributes: ['id', 'name'] }
          ]
        },
        {
          model: Payment,
          attributes: ['id', 'amount', 'method', 'status', 'reference']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    let totalGrossUSD = 0;
    let totalDoctorPayableUSD = 0;
    let totalClinicRetainedUSD = 0;
    let totalIslrWithheldUSD = 0;

    const doctorSummaryMap = {};

    for (const f of fees) {
      const gross = parseFloat(f.totalAmountUSD || 0);
      const payable = parseFloat(f.netPayableUSD || 0);
      const clinic = parseFloat(f.clinicAmountUSD || 0);
      const islr = parseFloat(f.retentionIslrUSD || 0);

      totalGrossUSD += gross;
      totalDoctorPayableUSD += payable;
      totalClinicRetainedUSD += clinic;
      totalIslrWithheldUSD += islr;

      const docId = f.doctorId;
      const docName = f.Doctor?.User ? `${f.Doctor.User.firstName} ${f.Doctor.User.lastName}` : 'Dr. Desconocido';
      const specialty = f.Doctor?.Specialty?.name || 'General';

      if (!doctorSummaryMap[docId]) {
        doctorSummaryMap[docId] = {
          doctorId: docId,
          doctorName: docName,
          specialty,
          totalEarnedUSD: 0,
          pendingPayoutUSD: 0,
          settledPayoutUSD: 0,
          feesCount: 0
        };
      }

      doctorSummaryMap[docId].totalEarnedUSD += payable;
      doctorSummaryMap[docId].feesCount += 1;
      if (f.status === 'PAID') {
        doctorSummaryMap[docId].settledPayoutUSD += payable;
      } else {
        doctorSummaryMap[docId].pendingPayoutUSD += payable;
      }
    }

    const doctorBreakdown = Object.values(doctorSummaryMap).map(d => ({
      ...d,
      totalEarnedUSD: this._round(d.totalEarnedUSD),
      pendingPayoutUSD: this._round(d.pendingPayoutUSD),
      settledPayoutUSD: this._round(d.settledPayoutUSD)
    })).sort((a, b) => b.totalEarnedUSD - a.totalEarnedUSD);

    return {
      summary: {
        totalGrossUSD: this._round(totalGrossUSD),
        totalDoctorPayableUSD: this._round(totalDoctorPayableUSD),
        totalClinicRetainedUSD: this._round(totalClinicRetainedUSD),
        totalIslrWithheldUSD: this._round(totalIslrWithheldUSD),
        totalFeeRecords: fees.length
      },
      doctorBreakdown,
      fees
    };
  }

  /**
   * Export revenue report payload and log audit event
   */
  async exportRevenueReport({
    organizationId = null,
    startDate = null,
    endDate = null,
    actorUserId = null,
    ip = null
  } = {}) {
    const analytics = await this.getRevenueAnalytics({
      organizationId,
      startDate,
      endDate,
      actorUserId,
      ip
    });

    const trends = await this.getRevenueTrends({
      organizationId,
      startDate,
      endDate,
      interval: 'daily'
    });

    await auditService.logEvent({
      action: 'REVENUE_REPORT_EXPORTED',
      entity: 'Payment',
      entityId: organizationId || 'GLOBAL',
      organizationId,
      actorUserId,
      newValues: {
        grossRevenueUSD: analytics.overview.grossRevenueUSD,
        exportedAt: new Date().toISOString()
      },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[RevenueIntelligence] Export audit failed' }));

    eventBus.publish(DOMAIN_EVENTS.REVENUE_REPORT_EXPORTED, {
      grossRevenueUSD: analytics.overview.grossRevenueUSD,
      exportedAt: new Date().toISOString()
    }, {
      organizationId,
      userId: actorUserId
    });

    return {
      exportedAt: new Date().toISOString(),
      period: { startDate, endDate },
      organizationId,
      ...analytics,
      trends: trends.trends
    };
  }
}

module.exports = new RevenueIntelligenceService();
