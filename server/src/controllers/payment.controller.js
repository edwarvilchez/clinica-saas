const { Payment, Patient, User, Appointment, Doctor, Organization } = require('../models');
const sendEmail = require('../utils/sendEmail');

exports.createPayment = async (req, res) => {
  try {
    const userRole = req.user.role ? req.user.role.toUpperCase() : '';
    const userId = req.user.id;

    if (userRole === 'PATIENT') {
        const patient = await Patient.findOne({ where: { userId } });
        if (!patient) return res.status(400).json({ error: 'Patient profile not found' });
        req.body.patientId = patient.id;
        req.body.status = 'Pending';
    }

    if (req.file) {
        req.body.receiptUrl = `/uploads/${req.file.filename}`;
    }

    // Automatically set organizationId if not provided (for multi-tenancy visibility)
    if (!req.body.organizationId && req.user.organizationId) {
        req.body.organizationId = req.user.organizationId;
    }

    // Logger to debug potential registration issues
    console.log('[DEBUG] Creating payment with body:', JSON.stringify(req.body, null, 2));

    const payment = await Payment.create(req.body);

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createSubscriptionPayment = async (req, res) => {
  try {
    const { amount, concept, instrument, reference, billingCycle, planType } = req.body;
    const user = req.user;

    let organizationId = null;

    if (user) {
        // Verify Organization ownership
        const org = await Organization.findByPk(user.organizationId);
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        if (org.ownerId !== user.id && user.role !== 'SUPERADMIN') {
           return res.status(403).json({ error: 'Only the organization owner can make subscription payments' });
        }
        organizationId = user.organizationId;
    }

    let receiptUrl = null;
    if (req.file) {
        receiptUrl = `/uploads/${req.file.filename}`;
    }

    const payment = await Payment.create({
      amount,
      concept,
      instrument,
      reference,
      status: 'Pending',
      paymentType: 'SUBSCRIPTION',
      billingCycle, 
      planType,     
      receiptUrl,
      organizationId: organizationId,
      patientId: null,
      appointmentId: null
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating subscription payment:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const userRole = req.user.role ? req.user.role.toUpperCase() : '';
    const userId = req.user.id;
    
    console.log(`[DEBUG] getPayments - Role: ${userRole}, UserID: ${userId}`);

    let whereClause = {};

    const isSuperAdmin = userRole === 'SUPERADMIN';

    if (userRole === 'PATIENT') {
       const patient = await Patient.findOne({ where: { userId } });
       
       if (!patient) {
         return res.json([]);
       }
       whereClause = { patientId: patient.id };
    } else if (!isSuperAdmin && req.user.organizationId) {
       whereClause.organizationId = req.user.organizationId;
    }

    const payments = await Payment.findAll({ 
      where: whereClause,
      include: [
        { model: Patient, include: [User] },
        { model: Organization },
        { 
          model: Appointment,
          include: [{ model: Doctor, include: [User] }]
        }
      ], 
      order: [['createdAt', 'DESC']] 
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
    const payment = await Payment.findByPk(id);
    
    if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
    }

    const oldStatus = payment.status;
    payment.status = 'Paid';
    await payment.save();

    // Confirm appointment automatically if linked
    if (payment.appointmentId) {
        await Appointment.update({ status: 'Confirmed' }, { where: { id: payment.appointmentId } });
    }

    // Handle Subscription Upgrade
    if (payment.paymentType === 'SUBSCRIPTION' && payment.planType) {
        if (payment.organizationId) {
            const org = await Organization.findByPk(payment.organizationId);
            if (org) {
                const now = new Date();
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
                });

                // Send Confirmation Email to Owner
                const owner = await User.findByPk(org.ownerId);
                if (owner && owner.email) {
                    await sendEmail({
                        email: owner.email,
                        subject: '¡Plan Clinica SaaS Activado!',
                        message: `Hola ${owner.firstName},\n\nHemos verificado con éxito tu pago de ${payment.amount} USD. Tu organización ${org.name} ahora tiene un plan ${org.type} ACTIVO hasta el ${newEndDate.toLocaleDateString()}.\n\nPlan: ${payment.planType}\nCiclo: ${payment.billingCycle}\n\nGracias por confiar en Clinica SaaS.\n\nSaludos,\nEquipo de Facturación.`
                    });
                }
            }
        }
    }

    res.json({ message: 'Payment marked as Paid and processed', payment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role ? req.user.role.toUpperCase() : '';
    const userId = req.user.id;

    const payment = await Payment.findByPk(id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (userRole === 'PATIENT') {
        const patient = await Patient.findOne({ where: { userId } });
        if (!patient || payment.patientId !== patient.id) {
            return res.status(403).json({ error: 'You can only delete your own payments' });
        }
        if (payment.status !== 'Pending') {
            return res.status(400).json({ error: 'Only pending payments can be deleted' });
        }
    }

    const paymentData = payment.toJSON();
    await payment.destroy();

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role ? req.user.role.toUpperCase() : '';
    const userId = req.user.id;

    const payment = await Payment.findByPk(id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (userRole === 'PATIENT') {
        const patient = await Patient.findOne({ where: { userId } });
        if (!patient || payment.patientId !== patient.id) {
            return res.status(403).json({ error: 'You can only update your own payments' });
        }
        if (payment.status !== 'Pending') {
            return res.status(400).json({ error: 'Only pending payments can be updated' });
        }
    }

    if (req.file) {
        req.body.receiptUrl = `/uploads/${req.file.filename}`;
    }

    await payment.update(req.body);
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Doctor Fee Reconciliation: Atomically splits payment revenue between doctor and clinic
 */
exports.reconcileDoctorFees = async (req, res) => {
  try {
    const { paymentId, doctorFeePercentage } = req.body;
    if (!paymentId) return res.status(400).json({ message: 'El ID del pago es obligatorio' });

    const payment = await Payment.findByPk(paymentId);
    if (!payment) return res.status(404).json({ message: 'Registro de pago no encontrado' });

    const splitPercent = parseFloat(doctorFeePercentage || payment.doctorFeePercentage || 70.00);
    const totalAmount = parseFloat(payment.amount || 0);

    const doctorFeeAmount = (totalAmount * (splitPercent / 100)).toFixed(2);
    const clinicFeeAmount = (totalAmount - doctorFeeAmount).toFixed(2);

    await payment.update({
      doctorFeePercentage: splitPercent,
      doctorFeeAmount,
      clinicFeeAmount,
      reconciliationStatus: 'RECONCILED'
    });

    res.json({
      message: '✅ Reconciliación de honorarios médicos completada exitosamente',
      paymentId: payment.id,
      reconciliation: {
        totalAmount: totalAmount.toFixed(2),
        doctorFeePercentage: `${splitPercent}%`,
        doctorFeeAmount,
        clinicFeeAmount,
        reconciliationStatus: 'RECONCILED'
      }
    });
  } catch (error) {
    console.error('Error in reconcileDoctorFees:', error);
    res.status(500).json({ error: error.message });
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

    const payment = await Payment.findByPk(paymentId);
    if (!payment) return res.status(404).json({ message: 'Registro de pago no encontrado' });

    const originalAmount = parseFloat(payment.amount);
    if (discount >= originalAmount) {
      return res.status(400).json({ message: 'El descuento no puede ser mayor o igual al monto total del pago' });
    }

    const finalAmount = (originalAmount - discount).toFixed(2);

    await payment.update({
      pharmacyDiscount: discount,
      amount: finalAmount
    });

    res.json({
      message: '✅ Descuento de farmacia aplicado exitosamente',
      paymentId: payment.id,
      discountBreakdown: {
        originalAmount: originalAmount.toFixed(2),
        pharmacyDiscountApplied: discount.toFixed(2),
        finalAdjustedAmount: finalAmount
      }
    });
  } catch (error) {
    console.error('Error in applyPharmacyDiscount:', error);
    res.status(500).json({ error: error.message });
  }
};
