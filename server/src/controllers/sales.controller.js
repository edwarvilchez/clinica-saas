const { ClinicalService, Quote, QuoteItem, Patient, Doctor, InsuranceCompany, Specialty, User, ClinicalPackage, sequelize } = require('../models');

const getOrgId = (req) => req.user?.organizationId || req.organizationId || null;
const isPlatformAdmin = (req) => req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';

// Default Venezuelan Clinical & Surgical packages seed
const DEFAULT_PACKAGES = [
  {
    code: 'PKG-MAT-01',
    name: 'Combo Parto Humanizado / Cesárea',
    category: 'MATERNITY',
    description: 'Paquete integral obstétrico con quirófano, 48h hospitalización, equipo médico, anestesia y atención neonatal.',
    totalPriceUSD: 1450.00,
    estimatedDurationHours: 48.0,
    items: [
      { concept: 'Derecho a Quirófano y Sala de Partos (2h)', quantity: 1, unitPriceUSD: 400.00, type: 'FACILITY' },
      { concept: 'Honorarios Gineco-Obstetra Principal y Ayudante', quantity: 1, unitPriceUSD: 500.00, type: 'HONORARIUM' },
      { concept: 'Honorarios Médico Anestesiólogo', quantity: 1, unitPriceUSD: 250.00, type: 'HONORARIUM' },
      { concept: 'Honorarios Pediatra - Neonatólogo (Recepción RN)', quantity: 1, unitPriceUSD: 150.00, type: 'HONORARIUM' },
      { concept: 'Habitación y Hospitalización Madre e Hijo (2 Días)', quantity: 2, unitPriceUSD: 60.00, type: 'STAY' },
      { concept: 'Kit Quirúrgico y Medicamentos de Cesárea/Parto', quantity: 1, unitPriceUSD: 30.00, type: 'SUPPLY' }
    ]
  },
  {
    code: 'PKG-QX-01',
    name: 'Combo Cirugía Apendicectomía Laparoscópica',
    category: 'SURGERY',
    description: 'Procedimiento quirúrgico mínimamente invasivo con 24h de hospitalización y control posoperatorio.',
    totalPriceUSD: 1200.00,
    estimatedDurationHours: 24.0,
    items: [
      { concept: 'Quirófano y Torre de Laparoscopia', quantity: 1, unitPriceUSD: 450.00, type: 'FACILITY' },
      { concept: 'Honorarios Cirujano General y 1er Ayudante', quantity: 1, unitPriceUSD: 450.00, type: 'HONORARIUM' },
      { concept: 'Honorarios Anestesiólogo', quantity: 1, unitPriceUSD: 200.00, type: 'HONORARIUM' },
      { concept: 'Hospitalización 1 Día en Habitación Semi-Privada', quantity: 1, unitPriceUSD: 50.00, type: 'STAY' },
      { concept: 'Medicamentos e Insumos Postoperatorios', quantity: 1, unitPriceUSD: 50.00, type: 'SUPPLY' }
    ]
  },
  {
    code: 'PKG-QX-02',
    name: 'Combo Colecistectomía Laparoscópica',
    category: 'SURGERY',
    description: 'Extracción de vesícula biliar por laparoscopia con estancia hospitalaria y recuperación.',
    totalPriceUSD: 1350.00,
    estimatedDurationHours: 24.0,
    items: [
      { concept: 'Uso de Quirófano + Torre Laparoscópica (3h)', quantity: 1, unitPriceUSD: 500.00, type: 'FACILITY' },
      { concept: 'Honorarios Cirujano y Ayudantía', quantity: 1, unitPriceUSD: 500.00, type: 'HONORARIUM' },
      { concept: 'Honorarios Anestesiología', quantity: 1, unitPriceUSD: 220.00, type: 'HONORARIUM' },
      { concept: 'Estancia Hospitalaria y Cuidados de Enfermería', quantity: 1, unitPriceUSD: 70.00, type: 'STAY' },
      { concept: 'Material Descartable y Suturas Quirúrgicas', quantity: 1, unitPriceUSD: 60.00, type: 'SUPPLY' }
    ]
  },
  {
    code: 'PKG-AMB-01',
    name: 'Combo Cirugía Menor Ambulatoria',
    category: 'SPECIALTY',
    description: 'Resección de lipomas, quistes, biopsias o suturas complejas en sala de procedimientos.',
    totalPriceUSD: 180.00,
    estimatedDurationHours: 2.0,
    items: [
      { concept: 'Sala de Procedimientos Menores', quantity: 1, unitPriceUSD: 60.00, type: 'FACILITY' },
      { concept: 'Honorarios Médico Tratante / Cirujano', quantity: 1, unitPriceUSD: 90.00, type: 'HONORARIUM' },
      { concept: 'Anestesia Local y Kit de Curación Descartable', quantity: 1, unitPriceUSD: 30.00, type: 'SUPPLY' }
    ]
  },
  {
    code: 'PKG-LAB-01',
    name: 'Combo Perfil 20 + Preoperatorio Integral',
    category: 'LABORATORY',
    description: 'Batería completa de laboratorio clínico, tiempos de coagulación y evaluación prequirúrgica.',
    totalPriceUSD: 65.00,
    estimatedDurationHours: 1.0,
    items: [
      { concept: 'Hematología Completa + VSG', quantity: 1, unitPriceUSD: 12.00, type: 'LAB' },
      { concept: 'Química Sanguínea (Glicemia, Urea, Creatinina, Ácido Úrico)', quantity: 1, unitPriceUSD: 18.00, type: 'LAB' },
      { concept: 'Perfil Lipídico (Colesterol, Triglicéridos, HDL, LDL)', quantity: 1, unitPriceUSD: 15.00, type: 'LAB' },
      { concept: 'Tiempos de Coagulación (PT, PTT, Fibrinógeno)', quantity: 1, unitPriceUSD: 12.00, type: 'LAB' },
      { concept: 'Tipiaje Sanguíneo y Examen General de Orina', quantity: 1, unitPriceUSD: 8.00, type: 'LAB' }
    ]
  },
  {
    code: 'PKG-EMG-01',
    name: 'Combo Triaje y Estabilización de Emergencia',
    category: 'EMERGENCY',
    description: 'Atención médica de urgencia, hidratación parenteral, medicación endovenosa y monitoreo.',
    totalPriceUSD: 95.00,
    estimatedDurationHours: 4.0,
    items: [
      { concept: 'Atención Médica de Emergencia y Triaje', quantity: 1, unitPriceUSD: 35.00, type: 'HONORARIUM' },
      { concept: 'Box de Emergencia y Monitoreo de Signos Vitales (4h)', quantity: 1, unitPriceUSD: 30.00, type: 'FACILITY' },
      { concept: 'Vía Endovenosa + Solución Fisiológica + Kit de Infusión', quantity: 1, unitPriceUSD: 15.00, type: 'SUPPLY' },
      { concept: 'Medicación de Urgencia (Analgésico/Antiespasmódico/Protector)', quantity: 1, unitPriceUSD: 15.00, type: 'DRUG' }
    ]
  }
];

// ── CLINICAL SERVICES ─────────────────────────
exports.getServices = async (req, res) => {
  try {
    const { category } = req.query;
    const where = {};
    if (category) where.category = category;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { organizationId: orgId },
        { organizationId: null } // System-wide global catalog services
      ];
    }

    const services = await ClinicalService.findAll({
      where,
      include: [{ model: Specialty, attributes: ['id', 'name'] }],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createService = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { code, name, category, description, priceUSD, isTaxExempt, taxRate, requiresDoctor, specialtyId } = req.body;

    if (!code || !name || priceUSD === undefined) {
      return res.status(400).json({ message: 'Código, nombre y precio en USD son obligatorios' });
    }

    const service = await ClinicalService.create({
      organizationId: orgId,
      code,
      name,
      category: category || 'CONSULTATION',
      description,
      priceUSD,
      isTaxExempt: isTaxExempt !== undefined ? isTaxExempt : true,
      taxRate: taxRate || 0.0,
      requiresDoctor: requiresDoctor || false,
      specialtyId: specialtyId || null
    });

    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── CLINICAL PACKAGES & COMBOS ────────────────
exports.getPackages = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    const where = {};

    if (!isSuperAdmin && orgId) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { organizationId: orgId },
        { organizationId: null }
      ];
    }

    let packages = await ClinicalPackage.findAll({
      where,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // Auto-seed for this organization if none exist
    if (packages.length === 0) {
      for (const pkg of DEFAULT_PACKAGES) {
        await ClinicalPackage.create({
          organizationId: orgId,
          ...pkg
        });
      }
      packages = await ClinicalPackage.findAll({
        where,
        order: [['category', 'ASC'], ['name', 'ASC']]
      });
    }

    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPackage = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { code, name, category, description, totalPriceUSD, estimatedDurationHours, items, notes } = req.body;

    if (!code || !name || totalPriceUSD === undefined) {
      return res.status(400).json({ message: 'Código, nombre y precio total son requeridos' });
    }

    const pkg = await ClinicalPackage.create({
      organizationId: orgId,
      code,
      name,
      category: category || 'SURGERY',
      description,
      totalPriceUSD,
      estimatedDurationHours: estimatedDurationHours || 2.0,
      items: items || [],
      notes
    });

    res.status(201).json(pkg);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await ClinicalPackage.findByPk(id);
    if (!pkg) {
      return res.status(404).json({ message: 'Paquete o combo no encontrado' });
    }

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && pkg.organizationId && pkg.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes permisos para modificar este paquete de otra clínica' });
    }

    await pkg.update(req.body);
    res.json(pkg);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await ClinicalPackage.findByPk(id);
    if (!pkg) {
      return res.status(404).json({ message: 'Paquete no encontrado' });
    }

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && pkg.organizationId && pkg.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este paquete de otra clínica' });
    }

    await pkg.destroy();
    res.json({ message: 'Paquete eliminado con éxito' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── QUOTES / ESTIMATES (PRESUPUESTOS CLÍNICOS) ─
exports.getQuotes = async (req, res) => {
  try {
    const { status, patientId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId) {
      where.organizationId = orgId;
    }

    const quotes = await Quote.findAll({
      where,
      include: [
        { model: QuoteItem, as: 'items' },
        { model: Patient, include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }] },
        { model: Doctor, include: [{ model: User, attributes: ['firstName', 'lastName'] }] },
        { model: InsuranceCompany, attributes: ['id', 'name', 'rif'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createQuote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const orgId = getOrgId(req);
    const {
      patientId,
      patientName,
      patientDocumentId,
      patientPhone,
      patientEmail,
      doctorId,
      insuranceCompanyId,
      title,
      bcvRate = 1.0,
      validDays = 15,
      items,
      notes,
      terms
    } = req.body;

    if (!patientName || !title || !items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Nombre del paciente, título y al menos 1 ítem son obligatorios' });
    }

    const count = await Quote.count({ where: orgId ? { organizationId: orgId } : {} });
    const quoteNumber = `COT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    let subtotalUSD = 0;
    const parsedItems = items.map(item => {
      const qty = parseInt(item.quantity || 1, 10);
      const uPriceUSD = parseFloat(item.unitPriceUSD || 0);
      const disc = parseFloat(item.discountPercent || 0);
      const totalUSD = (qty * uPriceUSD * (1 - disc / 100)).toFixed(2);
      const totalVES = (parseFloat(totalUSD) * parseFloat(bcvRate)).toFixed(2);

      subtotalUSD += parseFloat(totalUSD);

      return {
        serviceId: item.serviceId || null,
        concept: item.concept,
        quantity: qty,
        unitPriceUSD: uPriceUSD,
        unitPriceVES: (uPriceUSD * parseFloat(bcvRate)).toFixed(2),
        discountPercent: disc,
        totalPriceUSD: totalUSD,
        totalPriceVES: totalVES
      };
    });

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (parseInt(validDays, 10) || 15));

    const totalUSD = subtotalUSD;
    const totalVES = (totalUSD * parseFloat(bcvRate)).toFixed(2);

    const quote = await Quote.create({
      organizationId: orgId,
      quoteNumber,
      patientId: patientId || null,
      patientName,
      patientDocumentId,
      patientPhone,
      patientEmail,
      doctorId: doctorId || null,
      insuranceCompanyId: insuranceCompanyId || null,
      title,
      bcvRate,
      subtotalUSD: totalUSD.toFixed(2),
      totalUSD: totalUSD.toFixed(2),
      totalVES,
      patientPayableUSD: totalUSD.toFixed(2),
      validUntil,
      status: 'SENT',
      notes,
      terms
    }, { transaction: t });

    for (const item of parsedItems) {
      await QuoteItem.create({
        quoteId: quote.id,
        ...item
      }, { transaction: t });
    }

    await t.commit();

    const populated = await Quote.findByPk(quote.id, {
      include: [
        { model: QuoteItem, as: 'items' },
        { model: InsuranceCompany }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const quote = await Quote.findByPk(id);
    if (!quote) {
      return res.status(404).json({ message: 'Presupuesto no encontrado' });
    }

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && quote.organizationId && quote.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes permisos para modificar este presupuesto de otra clínica' });
    }

    await quote.update({ status });
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const quote = await Quote.findByPk(id);
    if (!quote) {
      return res.status(404).json({ message: 'Presupuesto no encontrado' });
    }

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && quote.organizationId && quote.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este presupuesto de otra clínica' });
    }

    await quote.destroy();
    res.json({ message: 'Presupuesto eliminado con éxito' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

