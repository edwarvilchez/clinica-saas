const { 
  InsuranceCompany, InsurancePolicy, InsuranceClaim, Patient, User, Doctor, Specialty, Organization 
} = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// ── INSURANCE COMPANIES ─────────────────────────
exports.getCompanies = async (req, res) => {
  try {
    const companies = await InsuranceCompany.findAll({
      include: [
        {
          model: InsurancePolicy,
          attributes: ['id', 'patientId', 'policyNumber', 'isActive'],
          include: [{ model: Patient, attributes: ['id', 'documentId'], include: [{ model: User, attributes: ['firstName', 'lastName'] }] }]
        }
      ],
      order: [['name', 'ASC']]
    });
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const orgId = req.organizationId || null;
    const { name, rif, phone, email, contactPerson, defaultCoveragePercent, paymentTermDays, notes } = req.body;

    if (!name || !rif) {
      return res.status(400).json({ message: 'El nombre y RIF de la aseguradora son obligatorios' });
    }

    const company = await InsuranceCompany.create({
      organizationId: orgId,
      name,
      rif,
      phone,
      email,
      contactPerson,
      defaultCoveragePercent: defaultCoveragePercent || 80.00,
      paymentTermDays: paymentTermDays || 30,
      notes
    });

    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await InsuranceCompany.findByPk(id);
    if (!company) {
      return res.status(404).json({ message: 'Aseguradora no encontrada' });
    }
    await company.update(req.body);
    res.json(company);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await InsuranceCompany.findByPk(id);
    if (!company) {
      return res.status(404).json({ message: 'Aseguradora no encontrada' });
    }
    await company.destroy();
    res.json({ message: 'Aseguradora eliminada con éxito' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PATIENT POLICIES ────────────────────────────
exports.getPolicies = async (req, res) => {
  try {
    const { patientId } = req.query;
    const where = {};
    if (patientId) where.patientId = patientId;

    const policies = await InsurancePolicy.findAll({
      where,
      include: [
        { model: InsuranceCompany, attributes: ['id', 'name', 'rif', 'phone'] },
        { 
          model: Patient, 
          attributes: ['id', 'documentId'],
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPolicy = async (req, res) => {
  try {
    const { patientId, insuranceCompanyId, policyNumber, certificateNumber, holderName, holderDocumentId, relationship, coveragePercent, deductibleUSD, expirationDate } = req.body;

    if (!patientId || !insuranceCompanyId || !policyNumber) {
      return res.status(400).json({ message: 'Paciente, aseguradora y número de póliza son requeridos' });
    }

    const policy = await InsurancePolicy.create({
      patientId,
      insuranceCompanyId,
      policyNumber,
      certificateNumber,
      holderName,
      holderDocumentId,
      relationship: relationship || 'Titular',
      coveragePercent: coveragePercent || 80.00,
      deductibleUSD: deductibleUSD || 0.00,
      expirationDate,
      isActive: true
    });

    const populated = await InsurancePolicy.findByPk(policy.id, {
      include: [
        { model: InsuranceCompany },
        { model: Patient, include: [{ model: User }] }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── CLAIMS TO INSURANCE COMPANIES (RECLAMOS / SINIESTROS) ─────────────────────────
exports.getClaims = async (req, res) => {
  try {
    const orgId = req.organizationId || null;
    const { insuranceCompanyId, patientId, doctorId, status, serviceType, startDate, endDate } = req.query;
    const where = {};
    if (orgId) where.organizationId = orgId;
    if (insuranceCompanyId) where.insuranceCompanyId = insuranceCompanyId;
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;
    if (serviceType) where.serviceType = serviceType;

    if (startDate && endDate) {
      where.serviceStartDate = { [Op.gte]: startDate };
      where.serviceEndDate = { [Op.lte]: endDate };
    } else if (startDate) {
      where.serviceStartDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.serviceEndDate = { [Op.lte]: endDate };
    }

    const claims = await InsuranceClaim.findAll({
      where,
      include: [
        {
          model: InsuranceCompany,
          attributes: ['id', 'name', 'rif', 'phone', 'email', 'contactPerson']
        },
        {
          model: Patient,
          attributes: ['id', 'documentId', 'gender', 'birthDate', 'phone', 'address'],
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] }]
        },
        {
          model: Doctor,
          attributes: ['id', 'mppsNumber', 'collegeNumber'],
          include: [
            { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
            { model: Specialty, attributes: ['id', 'name', 'nameEn', 'code'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getClaimById = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await InsuranceClaim.findByPk(id, {
      include: [
        {
          model: InsuranceCompany
        },
        {
          model: Patient,
          include: [{ model: User }]
        },
        {
          model: Doctor,
          include: [
            { model: User },
            { model: Specialty }
          ]
        }
      ]
    });

    if (!claim) {
      return res.status(404).json({ message: 'Reclamo de seguro no encontrado' });
    }

    res.json(claim);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createClaim = async (req, res) => {
  try {
    const orgId = req.organizationId || null;
    const {
      insuranceCompanyId,
      patientId,
      doctorId,
      policyNumber,
      authorizationCode,
      serviceType,
      serviceStartDate,
      serviceEndDate,
      diagnosis,
      items,
      grossAmountUSD,
      deductibleUSD,
      claimedAmountUSD,
      bcvRate,
      notes
    } = req.body;

    if (!insuranceCompanyId || !patientId || !serviceStartDate || !serviceEndDate) {
      return res.status(400).json({ 
        message: 'Aseguradora, paciente y rango de fechas del servicio son obligatorios.' 
      });
    }

    // Generate claimNumber: SIN-YYYY-XXXXX
    const year = new Date().getFullYear();
    const count = await InsuranceClaim.count();
    const claimNumber = `SIN-${year}-${String(count + 1).padStart(5, '0')}`;
    const claimToken = uuidv4();

    // Auto calculate claimed amount if not passed
    const gross = parseFloat(grossAmountUSD || 0);
    const ded = parseFloat(deductibleUSD || 0);
    const claimed = claimedAmountUSD !== undefined ? parseFloat(claimedAmountUSD) : Math.max(0, gross - ded);
    const rate = parseFloat(bcvRate || 1.0);

    const claim = await InsuranceClaim.create({
      organizationId: orgId,
      claimNumber,
      claimToken,
      insuranceCompanyId,
      patientId,
      doctorId: doctorId || null,
      policyNumber,
      authorizationCode,
      serviceType: serviceType || 'CONSULTATION',
      serviceStartDate,
      serviceEndDate,
      diagnosis,
      items: Array.isArray(items) ? items : [],
      grossAmountUSD: gross.toFixed(2),
      deductibleUSD: ded.toFixed(2),
      claimedAmountUSD: claimed.toFixed(2),
      bcvRate: rate.toFixed(4),
      status: 'EMITTED',
      notes
    });

    const populated = await InsuranceClaim.findByPk(claim.id, {
      include: [
        { model: InsuranceCompany },
        { model: Patient, include: [{ model: User }] },
        { model: Doctor, include: [{ model: User }, { model: Specialty }] }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateClaimStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, settledAmountUSD, settledDate, rejectionReason, notes } = req.body;

    const claim = await InsuranceClaim.findByPk(id);
    if (!claim) {
      return res.status(404).json({ message: 'Reclamo no encontrado' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (settledAmountUSD !== undefined) updates.settledAmountUSD = settledAmountUSD;
    if (settledDate !== undefined) updates.settledDate = settledDate;
    if (rejectionReason !== undefined) updates.rejectionReason = rejectionReason;
    if (notes !== undefined) updates.notes = notes;

    await claim.update(updates);

    const updated = await InsuranceClaim.findByPk(id, {
      include: [
        { model: InsuranceCompany },
        { model: Patient, include: [{ model: User }] },
        { model: Doctor, include: [{ model: User }, { model: Specialty }] }
      ]
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await InsuranceClaim.findByPk(id);
    if (!claim) {
      return res.status(404).json({ message: 'Reclamo no encontrado' });
    }

    await claim.destroy();
    res.json({ message: 'Reclamo eliminado con éxito' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET PUBLIC CLAIM VOUCHER BY TOKEN ─────────────────────────
exports.getClaimByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!token || !uuidRegex.test(token)) {
      return res.status(404).json({ message: 'Comprobante no encontrado o token inválido.' });
    }

    const claim = await InsuranceClaim.findOne({
      where: { claimToken: token },
      include: [
        {
          model: InsuranceCompany
        },
        {
          model: Patient,
          include: [{ model: User }]
        },
        {
          model: Doctor,
          include: [
            { model: User },
            { model: Specialty }
          ]
        },
        {
          model: Organization
        }
      ]
    });

    if (!claim) {
      return res.status(404).json({ message: 'Comprobante de siniestro / reclamo no encontrado o enlace inválido.' });
    }

    const rate = parseFloat(claim.bcvRate || 1.0);
    const grossUSD = parseFloat(claim.grossAmountUSD || 0);
    const dedUSD = parseFloat(claim.deductibleUSD || 0);
    const claimedUSD = parseFloat(claim.claimedAmountUSD || 0);
    const settledUSD = parseFloat(claim.settledAmountUSD || 0);

    res.json({
      claimNumber: claim.claimNumber,
      claimToken: claim.claimToken,
      createdAt: claim.createdAt,
      status: claim.status,
      authorizationCode: claim.authorizationCode,
      policyNumber: claim.policyNumber,
      serviceType: claim.serviceType,
      serviceStartDate: claim.serviceStartDate,
      serviceEndDate: claim.serviceEndDate,
      diagnosis: claim.diagnosis,
      items: claim.items || [],
      grossAmountUSD: grossUSD.toFixed(2),
      deductibleUSD: dedUSD.toFixed(2),
      claimedAmountUSD: claimedUSD.toFixed(2),
      settledAmountUSD: settledUSD.toFixed(2),
      grossAmountVES: (grossUSD * rate).toFixed(2),
      deductibleVES: (dedUSD * rate).toFixed(2),
      claimedAmountVES: (claimedUSD * rate).toFixed(2),
      settledAmountVES: (settledUSD * rate).toFixed(2),
      bcvRate: rate.toFixed(4),
      notes: claim.notes,
      rejectionReason: claim.rejectionReason,
      settledDate: claim.settledDate,
      insuranceCompany: claim.InsuranceCompany,
      patient: claim.Patient,
      doctor: claim.Doctor,
      organization: claim.Organization || {
        name: 'Clínica SaaS Internacional',
        rif: 'J-40987654-1',
        phone: '+58 (212) 555-0100',
        email: 'reclamos@clinicasaas.com',
        address: 'Av. Principal Las Mercedes, Edif. Centro Médico Caracas, Venezuela'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
