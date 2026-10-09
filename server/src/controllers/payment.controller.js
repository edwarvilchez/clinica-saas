const fs = require('fs');
const { Payment, Patient, User, Appointment, Doctor, Organization, sequelize } = require('../models');
const sendEmail = require('../utils/sendEmail');
const fileStorageService = require('../services/fileStorage.service');
const { getTenantTransaction } = require('../utils/tenantRls');

const saveUploadedReceipt = async (file, organizationId) => {
  if (!file) return null;
  const buffer = file.buffer || (file.path ? await fs.promises.readFile(file.path) : null);
  if (!buffer) return null;

  const saved = await fileStorageService.saveFile({
    buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    organizationId: organizationId || 'system',
    folder: 'receipts'
  });

  if (file.path) {
    await fs.promises.unlink(file.path).catch(() => {});
  }

  return saved.storageKey;
};

exports.createPayment = async (req, res) => {
  try {
    const userRole = req.user?.role ? req.user.role.toUpperCase() : '';
    const userId = req.user?.id;
    const withTx = getTenantTransaction(req);

    const payment = await withTx(async (t) => {
      if (userRole === 'PATIENT') {
        const patient = await Patient.findOne({ where: { userId }, transaction: t });
        if (!patient) {
          const err = new Error('Patient profile not found');
          err.status = 400;
          throw err;
        }
        req.body.patientId = patient.id;
        req.body.status = 'Pending';
      }

      if (req.file) {
        req.body.receiptUrl = await saveUploadedReceipt(req.file, req.body.organizationId || req.user?.organizationId);
      }

      if (!req.body.organizationId && req.user?.organizationId) {
        req.body.organizationId = req.user.organizationId;
      }

      return await Payment.create(req.body, { transaction: t });
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(error.status || 500).json({ message: error.message, error: error.message });
  }
};

exports.createSubscriptionPayment = async (req, res) => {
  try {
    const { amount, concept, instrument, reference, billingCycle, planType } = req.body;
    const user = req.user;
    const withTx = getTenantTransaction(req);

    const payment = await withTx(async (t) => {
      let organizationId = null;

      if (user) {
        const org = await Organization.findByPk(user.organizationId, { transaction: t });
        if (!org) {
          const err = new Error('Organization not found');
          err.status = 404;
          throw err;
        }
        if (org.ownerId !== user.id && user.role !== 'SUPERADMIN' && user.role !== 'PLATFORM_ADMIN') {
          const err = new Error('Only the organization owner can make subscription payments');
          err.status = 403;
          throw err;
        }
        organizationId = user.organizationId;
      }

      let receiptUrl = null;
      if (req.file) {
        receiptUrl = await saveUploadedReceipt(req.file, organizationId);
      }

      return await Payment.create({
        amount,
        concept,
        instrument,
        reference,
        status: 'Pending',
        paymentType: 'SUBSCRIPTION',
        billingCycle, 
        planType,     
        receiptUrl,
        organizationId,
        patientId: null,
        appointmentId: null
      }, { transaction: t });
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating subscription payment:', error);
    res.status(error.status || 500).json({ message: error.message, error: error.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const userRole = req.user?.role ? req.user.role.toUpperCase() : '';
    const userId = req.user?.id;
    const isSuperAdmin = userRole === 'SUPERADMIN' || userRole === 'PLATFORM_ADMIN';
    const withTx = getTenantTransaction(req);

    const payments = await withTx(async (t) => {
      let whereClause = {};

      if (userRole === 'PATIENT') {
        const patient = await Patient.findOne({ where: { userId }, transaction: t });
        if (!patient) return [];
        whereClause = { patientId: patient.id };
      } else if (!isSuperAdmin && req.user?.organizationId) {
        whereClause.organizationId = req.user.organizationId;
      }

      return await Payment.findAll({ 
        where: whereClause,
        include: [
          { model: Patient, include: [User] },
          { model: Organization },
          { 
            model: Appointment,
            include: [{ model: Doctor, include: [User] }]
          }
        ], 
        order: [['createdAt', 'DESC']],
        transaction: t
      });
    });

    res.json(payments);
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.collectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const withTx = getTenantTransaction(req);
    let emailToSend = null;
    let paymentResult = null;

    await withTx(async (t) => {
      const payment = await Payment.findByPk(id, { transaction: t });
      if (!payment) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
      if (!isSuperAdmin && req.user?.organizationId && payment.organizationId && payment.organizationId !== req.user.organizationId) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      payment.status = 'Paid';
      await payment.save({ transaction: t });

      if (payment.appointmentId) {
        await Appointment.update({ status: 'Confirmed' }, { where: { id: payment.appointmentId }, transaction: t });
      }

      if (payment.paymentType === 'SUBSCRIPTION' && payment.planType) {
        if (payment.organizationId) {
          const org = await Organization.findByPk(payment.organizationId, { transaction: t });
          if (org) {
            let newEndDate = new Date();
            
            if (payment.billingCycle === 'Mensual') newEndDate.setMonth(newEndDate.getMonth() + 1);
            else if (payment.billingCycle === 'Trimestral') newEndDate.setMonth(newEndDate.getMonth() + 3);
            else if (payment.billingCycle === 'Semestral') newEndDate.setMonth(newEndDate.getMonth() + 6);
            else if (payment.billingCycle === 'Anual') newEndDate.setFullYear(newEndDate.getFullYear() + 1);
            else newEndDate.setMonth(newEndDate.getMonth() + 1); 

            await org.update({
              subscriptionStatus: 'ACTIVE',
              type: payment.planType,
              trialEndsAt: newEndDate
            }, { transaction: t });

            const owner = await User.findByPk(org.ownerId, { transaction: t });
            if (owner && owner.email) {
              emailToSend = {
                email: owner.email,
                subject: '¡Plan Clinica SaaS Activado!',
                message: `Hola ${owner.firstName},\n\nHemos verificado con éxito tu pago de ${payment.amount} USD. Tu organización ${org.name} ahora tiene un plan ${org.type} ACTIVO hasta el ${newEndDate.toLocaleDateString()}.\n\nPlan: ${payment.planType}\nCiclo: ${payment.billingCycle}\n\nGracias por confiar en Clinica SaaS.\n\nSaludos,\nEquipo de Facturación.`
              };
            }
          }
        }
      }

      paymentResult = payment;
    });

    if (emailToSend) {
      sendEmail(emailToSend).catch(err => console.error('Error sending confirmation email:', err));
    }

    try {
      const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
      eventBus.publish(DOMAIN_EVENTS.PAYMENT_COLLECTED, {
        paymentId: paymentResult.id,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        paymentType: paymentResult.paymentType,
        patientId: paymentResult.patientId,
        appointmentId: paymentResult.appointmentId
      }, {
        organizationId: paymentResult.organizationId,
        userId: req.user?.id,
        requestId: req.headers ? req.headers['x-request-id'] : null
      });
    } catch (busErr) {}

    res.json({ message: 'Payment marked as Paid and processed', payment: paymentResult });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role ? req.user.role.toUpperCase() : '';
    const userId = req.user?.id;
    const isSuperAdmin = userRole === 'SUPERADMIN' || userRole === 'PLATFORM_ADMIN';
    const withTx = getTenantTransaction(req);

    await withTx(async (t) => {
      const payment = await Payment.findByPk(id, { transaction: t });
      if (!payment) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      if (userRole === 'PATIENT') {
        const patient = await Patient.findOne({ where: { userId }, transaction: t });
        if (!patient || payment.patientId !== patient.id) {
          const err = new Error('You can only delete your own payments');
          err.status = 403;
          throw err;
        }
        if (payment.status !== 'Pending') {
          const err = new Error('Only pending payments can be deleted');
          err.status = 400;
          throw err;
        }
      } else if (!isSuperAdmin && req.user?.organizationId && payment.organizationId && payment.organizationId !== req.user.organizationId) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      await payment.destroy({ transaction: t });
    });

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role ? req.user.role.toUpperCase() : '';
    const userId = req.user?.id;
    const isSuperAdmin = userRole === 'SUPERADMIN' || userRole === 'PLATFORM_ADMIN';
    const withTx = getTenantTransaction(req);

    const updatedPayment = await withTx(async (t) => {
      const payment = await Payment.findByPk(id, { transaction: t });
      if (!payment) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      if (userRole === 'PATIENT') {
        const patient = await Patient.findOne({ where: { userId }, transaction: t });
        if (!patient || payment.patientId !== patient.id) {
          const err = new Error('You can only update your own payments');
          err.status = 403;
          throw err;
        }
        if (payment.status !== 'Pending') {
          const err = new Error('Only pending payments can be updated');
          err.status = 400;
          throw err;
        }
      } else if (!isSuperAdmin && req.user?.organizationId && payment.organizationId && payment.organizationId !== req.user.organizationId) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      if (req.file) {
        req.body.receiptUrl = await saveUploadedReceipt(req.file, payment.organizationId);
      }

      await payment.update(req.body, { transaction: t });
      return payment;
    });

    res.json(updatedPayment);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

/**
 * Doctor Fee Reconciliation: Atomically splits payment revenue between doctor and clinic
 */
exports.reconcileDoctorFees = async (req, res) => {
  try {
    const { paymentId, doctorFeePercentage } = req.body;
    if (!paymentId) {
      return res.status(400).json({ message: 'El ID del pago es obligatorio' });
    }

    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const payment = await Payment.findByPk(paymentId, { transaction: t });
      if (!payment) {
        const err = new Error('Registro de pago no encontrado');
        err.status = 404;
        throw err;
      }

      if (!isSuperAdmin && req.user?.organizationId && payment.organizationId && payment.organizationId !== req.user.organizationId) {
        const err = new Error('Registro de pago no encontrado');
        err.status = 404;
        throw err;
      }

      const splitPercent = parseFloat(doctorFeePercentage || payment.doctorFeePercentage || 70.00);
      const totalAmount = parseFloat(payment.amount || 0);

      const doctorFeeAmount = (totalAmount * (splitPercent / 100)).toFixed(2);
      const clinicFeeAmount = (totalAmount - doctorFeeAmount).toFixed(2);

      await payment.update({
        doctorFeePercentage: splitPercent,
        doctorFeeAmount,
        clinicFeeAmount,
        reconciliationStatus: 'RECONCILED'
      }, { transaction: t });

      return {
        paymentId: payment.id,
        totalAmount: totalAmount.toFixed(2),
        splitPercent,
        doctorFeeAmount,
        clinicFeeAmount
      };
    });

    res.json({
      message: '✅ Reconciliación de honorarios médicos completada exitosamente',
      paymentId: result.paymentId,
      reconciliation: {
        totalAmount: result.totalAmount,
        doctorFeePercentage: `${result.splitPercent}%`,
        doctorFeeAmount: result.doctorFeeAmount,
        clinicFeeAmount: result.clinicFeeAmount,
        reconciliationStatus: 'RECONCILED'
      }
    });
  } catch (error) {
    console.error('Error in reconcileDoctorFees:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
};

/**
 * Apply Direct Pharmacy Discount to Payment
 */
exports.applyPharmacyDiscount = async (req, res) => {
  try {
    const { paymentId, discountAmount } = req.body;
    const discount = parseFloat(discountAmount || 0);

    if (!paymentId || discount <= 0) {
      return res.status(400).json({ message: 'ID de pago y monto de descuento válido son obligatorios' });
    }

    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const payment = await Payment.findByPk(paymentId, { transaction: t });
      if (!payment) {
        const err = new Error('Registro de pago no encontrado');
        err.status = 404;
        throw err;
      }

      if (!isSuperAdmin && req.user?.organizationId && payment.organizationId && payment.organizationId !== req.user.organizationId) {
        const err = new Error('Registro de pago no encontrado');
        err.status = 404;
        throw err;
      }

      const originalAmount = parseFloat(payment.amount);
      if (discount >= originalAmount) {
        const err = new Error('El descuento no puede ser mayor o igual al monto total del pago');
        err.status = 400;
        throw err;
      }

      const finalAmount = (originalAmount - discount).toFixed(2);

      await payment.update({
        pharmacyDiscount: discount,
        amount: finalAmount
      }, { transaction: t });

      return {
        paymentId: payment.id,
        originalAmount: originalAmount.toFixed(2),
        discount: discount.toFixed(2),
        finalAmount
      };
    });

    res.json({
      message: '✅ Descuento de farmacia aplicado exitosamente',
      paymentId: result.paymentId,
      discountBreakdown: {
        originalAmount: result.originalAmount,
        pharmacyDiscountApplied: result.discount,
        finalAdjustedAmount: result.finalAmount
      }
    });
  } catch (error) {
    console.error('Error in applyPharmacyDiscount:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
};
