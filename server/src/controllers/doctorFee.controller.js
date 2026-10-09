const { 
  DoctorFee, Doctor, Patient, User, Payment, Specialty, 
  ClinicalService, InsuranceCompany, AccountChart, JournalEntry, JournalItem, sequelize 
} = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { getTenantTransaction } = require('../utils/tenantRls');

const getOrgId = (req) => req.user?.organizationId || req.organizationId || null;
const isPlatformAdmin = (req) => req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';

// List doctor fees (filterable by doctor, status PENDING/PAID, serviceType, date range)
exports.getDoctorFees = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const { doctorId, status, serviceType, startDate, endDate } = req.query;
    const withTx = getTenantTransaction(req);

    const where = {};
    if (!isSuperAdmin && orgId) where.organizationId = orgId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;
    if (serviceType) where.serviceType = serviceType;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const fees = await withTx(async (t) => {
      return DoctorFee.findAll({
        where,
        include: [
          {
            model: Doctor,
            include: [
              { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
              { model: Specialty, attributes: ['id', 'name', 'nameEn', 'code'] }
            ]
          },
          {
            model: Patient,
            include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
          },
          {
            model: ClinicalService,
            attributes: ['id', 'code', 'name', 'nameEn', 'category', 'basePriceUSD']
          },
          {
            model: InsuranceCompany,
            attributes: ['id', 'name', 'rif', 'phone']
          },
          {
            model: Payment,
            attributes: ['id', 'amount', 'currency', 'method', 'status', 'reference']
          }
        ],
        order: [['createdAt', 'DESC']],
        transaction: t
      });
    });

    res.json(fees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Doctor Fee Configuration & Baremos for all doctors in clinic
exports.getDoctorConfigs = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const withTx = getTenantTransaction(req);
    const where = {};
    if (!isSuperAdmin && orgId) where.organizationId = orgId;

    const doctors = await withTx(async (t) => {
      return Doctor.findAll({
        where,
        include: [
          { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Specialty, attributes: ['id', 'name', 'nameEn'] }
        ],
        order: [['createdAt', 'DESC']],
        transaction: t
      });
    });

    const configs = doctors.map(doc => ({
      doctorId: doc.id,
      doctorName: doc.User ? `Dr. ${doc.User.firstName} ${doc.User.lastName}` : 'Dr.',
      specialty: doc.Specialty?.name || 'General',
      mppsNumber: doc.mppsNumber,
      collegeNumber: doc.collegeNumber,
      chargesProfessionalFees: doc.chargesProfessionalFees !== false,
      feeType: doc.feeType || 'PERCENTAGE',
      doctorPercent: parseFloat(doc.doctorPercent || 70.0),
      clinicPercent: parseFloat(100 - (doc.doctorPercent || 70.0)),
      fixedFeeUSD: parseFloat(doc.fixedFeeUSD || 30.0),
      insuranceDoctorPercent: parseFloat(doc.insuranceDoctorPercent || 65.0),
      insuranceFixedFeeUSD: parseFloat(doc.insuranceFixedFeeUSD || 25.0),
      acceptsInsurance: doc.acceptsInsurance !== false
    }));

    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Doctor Fee Configuration & Baremos
exports.updateDoctorConfig = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const {
      feeType,
      doctorPercent,
      fixedFeeUSD,
      insuranceDoctorPercent,
      insuranceFixedFeeUSD,
      acceptsInsurance,
      chargesProfessionalFees
    } = req.body;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const withTx = getTenantTransaction(req);

    const doctor = await withTx(async (t) => {
      const doc = await Doctor.findByPk(doctorId, { transaction: t });
      if (!doc) {
        const err = new Error('Médico no encontrado.');
        err.status = 404;
        throw err;
      }

      if (!isSuperAdmin && orgId && doc.organizationId && doc.organizationId !== orgId) {
        const err = new Error('No tienes permisos para modificar este médico de otra clínica');
        err.status = 403;
        throw err;
      }

      await doc.update({
        feeType: feeType || doc.feeType,
        doctorPercent: doctorPercent !== undefined ? parseFloat(doctorPercent) : doc.doctorPercent,
        fixedFeeUSD: fixedFeeUSD !== undefined ? parseFloat(fixedFeeUSD) : doc.fixedFeeUSD,
        insuranceDoctorPercent: insuranceDoctorPercent !== undefined ? parseFloat(insuranceDoctorPercent) : doc.insuranceDoctorPercent,
        insuranceFixedFeeUSD: insuranceFixedFeeUSD !== undefined ? parseFloat(insuranceFixedFeeUSD) : doc.insuranceFixedFeeUSD,
        acceptsInsurance: acceptsInsurance !== undefined ? Boolean(acceptsInsurance) : doc.acceptsInsurance,
        chargesProfessionalFees: chargesProfessionalFees !== undefined ? Boolean(chargesProfessionalFees) : doc.chargesProfessionalFees
      }, { transaction: t });

      return doc;
    });

    res.json({
      message: 'Configuración de honorarios y baremos del médico actualizada exitosamente.',
      doctor
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

// Create a new doctor fee entry (atado a servicio, paciente y aseguradora)
exports.createDoctorFee = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      doctorId,
      patientId,
      clinicalServiceId,
      insuranceCompanyId,
      paymentId,
      serviceConcept,
      serviceType,
      feeType = 'PERCENTAGE',
      totalAmountUSD,
      bcvRate = 1.0,
      doctorPercent = 70.0,
      clinicPercent = 30.0,
      fixedFeeUSD = 0,
      retentionIslrPercent = 3.0,
      notes
    } = req.body;

    if (!doctorId || !serviceConcept || !totalAmountUSD) {
      return res.status(400).json({ message: 'Médico, concepto de servicio y monto son obligatorios.' });
    }

    const grossUSD = parseFloat(totalAmountUSD);
    const rate = parseFloat(bcvRate) || 1.0;
    const islrPercent = parseFloat(retentionIslrPercent) || 3.0;

    let docAmountUSD = 0;
    let clinAmountUSD = 0;

    if (feeType === 'FIXED_AMOUNT') {
      docAmountUSD = parseFloat(fixedFeeUSD) > 0 ? parseFloat(fixedFeeUSD) : grossUSD * 0.7;
      clinAmountUSD = Math.max(0, grossUSD - docAmountUSD);
    } else {
      const docPct = parseFloat(doctorPercent) || 70.0;
      const clinPct = parseFloat(clinicPercent) || (100 - docPct);
      docAmountUSD = grossUSD * (docPct / 100);
      clinAmountUSD = grossUSD * (clinPct / 100);
    }

    const retentionIslrUSD = docAmountUSD * (islrPercent / 100);
    const netPayableUSD = docAmountUSD - retentionIslrUSD;
    const totalAmountVES = grossUSD * rate;

    const withTx = getTenantTransaction(req);

    const populated = await withTx(async (t) => {
      const fee = await DoctorFee.create({
        organizationId: orgId,
        doctorId,
        patientId: patientId || null,
        clinicalServiceId: clinicalServiceId || null,
        insuranceCompanyId: insuranceCompanyId || null,
        paymentId: paymentId || null,
        serviceConcept,
        serviceType: serviceType || 'CONSULTATION',
        feeType,
        totalAmountUSD: grossUSD.toFixed(2),
        totalAmountVES: totalAmountVES.toFixed(2),
        bcvRate: rate,
        doctorPercent: parseFloat(doctorPercent) || 70.0,
        clinicPercent: parseFloat(clinicPercent) || 30.0,
        doctorAmountUSD: docAmountUSD.toFixed(2),
        clinicAmountUSD: clinAmountUSD.toFixed(2),
        retentionIslrPercent: islrPercent,
        retentionIslrUSD: retentionIslrUSD.toFixed(2),
        netPayableUSD: netPayableUSD.toFixed(2),
        status: 'PENDING',
        notes
      }, { transaction: t });

      return DoctorFee.findByPk(fee.id, {
        include: [
          { model: Doctor, include: [{ model: User }, { model: Specialty }] },
          { model: Patient, include: [{ model: User }] },
          { model: ClinicalService },
          { model: InsuranceCompany }
        ],
        transaction: t
      });
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Process Payment / Settlement of Doctor Fees (Single or Batch CXP)
exports.payDoctorFees = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const withTx = getTenantTransaction(req);
    const {
      feeIds, // Array of DoctorFee IDs
      paymentMethod = 'Transferencia Bancaria',
      paymentReference,
      bcvRate = 1.0,
      notes
    } = req.body;

    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return res.status(400).json({ message: 'Debe seleccionar al menos un honorario para procesar el pago.' });
    }

    const feeWhere = {
      id: { [Op.in]: feeIds },
      status: 'PENDING'
    };
    if (!isSuperAdmin && orgId) {
      feeWhere.organizationId = orgId;
    }

    const result = await withTx(async (t) => {
      const fees = await DoctorFee.findAll({
        where: feeWhere,
        include: [
          { model: Doctor, include: [{ model: User }] },
          { model: Patient, include: [{ model: User }] },
          { model: ClinicalService }
        ],
        transaction: t
      });

      if (fees.length === 0) {
        const err = new Error('No se encontraron honorarios pendientes de pago para procesar.');
        err.status = 400;
        throw err;
      }

      const now = new Date();
      const rate = parseFloat(bcvRate) || 1.0;
      const processedFees = [];
      let totalPaidUSD = 0;
      let totalPaidVES = 0;
      let totalRetentionUSD = 0;

      const count = await DoctorFee.count({ where: { status: 'PAID' }, transaction: t });

      for (let i = 0; i < fees.length; i++) {
        const fee = fees[i];
        const netUSD = parseFloat(fee.netPayableUSD);
        const netVES = netUSD * rate;
        const islrUSD = parseFloat(fee.retentionIslrUSD || 0);

        totalPaidUSD += netUSD;
        totalPaidVES += netVES;
        totalRetentionUSD += islrUSD;

        const receiptNumber = `REC-HON-${now.getFullYear()}-${String(count + i + 1).padStart(5, '0')}`;
        const receiptToken = uuidv4();

        await fee.update({
          status: 'PAID',
          settlementDate: now,
          paidAt: now,
          paidAmountUSD: netUSD.toFixed(2),
          paidAmountVES: netVES.toFixed(2),
          paidPaymentMethod: paymentMethod,
          paymentReference: paymentReference || `REF-${now.getTime()}`,
          receiptNumber,
          receiptToken,
          notes: notes ? `${fee.notes || ''} | ${notes}` : fee.notes
        }, { transaction: t });

        processedFees.push(fee);
      }

      // Generate balanced Journal Entry in Venezuelan Accounting (Cuentas por Pagar Médicos)
      try {
        const cxpAccount = await AccountChart.findOne({ where: { code: '2.1.02.01' }, transaction: t }) ||
                           await AccountChart.findOne({ where: { accountType: 'LIABILITY' }, transaction: t });
        const bankAccount = await AccountChart.findOne({ where: { code: '1.1.01.02' }, transaction: t }) ||
                            await AccountChart.findOne({ where: { accountType: 'ASSET' }, transaction: t });
        const islrRetentionAccount = await AccountChart.findOne({ where: { code: '2.1.03.02' }, transaction: t });

        if (cxpAccount && bankAccount) {
          const grossDoctorUSD = totalPaidUSD + totalRetentionUSD;
          const entryCount = await JournalEntry.count({ transaction: t });
          const entryNumber = `AS-HON-${now.getFullYear()}-${String(entryCount + 1).padStart(5, '0')}`;

          const entry = await JournalEntry.create({
            organizationId: orgId,
            entryNumber,
            entryDate: now,
            concept: `Pago de Honorarios Médicos CXP - ${processedFees.length} servicios (${paymentMethod})`,
            sourceModule: 'DOCTOR_FEES',
            bcvRate: rate,
            totalDebitUSD: grossDoctorUSD.toFixed(2),
            totalCreditUSD: grossDoctorUSD.toFixed(2),
            totalDebitVES: (grossDoctorUSD * rate).toFixed(2),
            totalCreditVES: (grossDoctorUSD * rate).toFixed(2),
            isBalanced: true,
            status: 'POSTED'
          }, { transaction: t });

          // Debit: CXP Médicos (Disminuye pasivo)
          await JournalItem.create({
            journalEntryId: entry.id,
            accountId: cxpAccount.id,
            description: `Liquidación CXP Honorarios Médicos (${processedFees.length} registros)`,
            debitUSD: grossDoctorUSD.toFixed(2),
            creditUSD: 0,
            debitVES: (grossDoctorUSD * rate).toFixed(2),
            creditVES: 0
          }, { transaction: t });

          // Credit: Banco / Caja (Salida de dinero neto)
          await JournalItem.create({
            journalEntryId: entry.id,
            accountId: bankAccount.id,
            description: `Desembolso pago honorarios Ref: ${paymentReference || 'Directo'}`,
            debitUSD: 0,
            creditUSD: totalPaidUSD.toFixed(2),
            debitVES: 0,
            creditVES: totalPaidVES.toFixed(2)
          }, { transaction: t });

          // Credit: Retención ISLR 3% por Pagar al SENIAT (si aplica)
          if (totalRetentionUSD > 0 && islrRetentionAccount) {
            await JournalItem.create({
              journalEntryId: entry.id,
              accountId: islrRetentionAccount.id,
              description: `Retención ISLR 3% Honorarios Médicos SENIAT`,
              debitUSD: 0,
              creditUSD: totalRetentionUSD.toFixed(2),
              debitVES: 0,
              creditVES: (totalRetentionUSD * rate).toFixed(2)
            }, { transaction: t });
          }
        }
      } catch (accErr) {
        console.warn('Accounting entry warning during fee settlement:', accErr.message);
      }

      return {
        processedFees,
        totalPaidUSD,
        totalPaidVES,
        now
      };
    });

    res.json({
      message: `¡Pago de ${result.processedFees.length} honorario(s) procesado exitosamente!`,
      totalPaidUSD: result.totalPaidUSD.toFixed(2),
      totalPaidVES: result.totalPaidVES.toFixed(2),
      paidAt: result.now,
      receiptNumbers: result.processedFees.map(f => f.receiptNumber),
      receiptTokens: result.processedFees.map(f => f.receiptToken),
      fees: result.processedFees
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

// Query digital payment receipt by public/secure token
exports.getReceiptByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const fee = await DoctorFee.findOne({
      where: { receiptToken: token },
      include: [
        {
          model: Doctor,
          include: [
            { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
            { model: Specialty, attributes: ['id', 'name', 'nameEn'] }
          ]
        },
        {
          model: Patient,
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
        },
        {
          model: ClinicalService
        },
        {
          model: InsuranceCompany
        }
      ]
    });

    if (!fee) {
      return res.status(404).json({ message: 'Recibo de pago no encontrado o enlace inválido.' });
    }

    res.json({
      receiptNumber: fee.receiptNumber,
      receiptToken: fee.receiptToken,
      paidAt: fee.paidAt || fee.settlementDate,
      paidPaymentMethod: fee.paidPaymentMethod,
      paymentReference: fee.paymentReference,
      status: fee.status,
      bcvRate: fee.bcvRate,
      amounts: {
        totalAmountUSD: fee.totalAmountUSD,
        totalAmountVES: fee.totalAmountVES,
        doctorPercent: fee.doctorPercent,
        clinicPercent: fee.clinicPercent,
        doctorAmountUSD: fee.doctorAmountUSD,
        clinicAmountUSD: fee.clinicAmountUSD,
        retentionIslrPercent: fee.retentionIslrPercent,
        retentionIslrUSD: fee.retentionIslrUSD,
        netPayableUSD: fee.netPayableUSD,
        netPayableVES: fee.paidAmountVES || (parseFloat(fee.netPayableUSD) * parseFloat(fee.bcvRate)).toFixed(2)
      },
      doctor: {
        id: fee.Doctor?.id,
        name: fee.Doctor?.User ? `Dr. ${fee.Doctor.User.firstName} ${fee.Doctor.User.lastName}` : 'Dr.',
        email: fee.Doctor?.User?.email,
        phone: fee.Doctor?.phone,
        mppsNumber: fee.Doctor?.mppsNumber,
        collegeNumber: fee.Doctor?.collegeNumber,
        specialty: fee.Doctor?.Specialty?.name || 'General',
        university: fee.Doctor?.university,
        degreeTitle: fee.Doctor?.degreeTitle
      },
      patient: {
        id: fee.Patient?.id,
        name: fee.Patient?.User ? `${fee.Patient.User.firstName} ${fee.Patient.User.lastName}` : 'Paciente Clínico',
        documentId: fee.Patient?.documentId || 'V-N/A'
      },
      service: {
        concept: fee.serviceConcept,
        serviceType: fee.serviceType,
        serviceCode: fee.ClinicalService?.code || 'SRV',
        serviceName: fee.ClinicalService?.name || fee.serviceConcept
      },
      insurance: fee.InsuranceCompany ? {
        name: fee.InsuranceCompany.name,
        rif: fee.InsuranceCompany.rif
      } : null,
      notes: fee.notes
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
