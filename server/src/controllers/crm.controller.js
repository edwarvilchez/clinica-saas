'use strict';

const { 
  Lead, 
  Patient, 
  User, 
  Specialty, 
  Role, 
  Organization, 
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const { eventBus } = require('../events/eventBus');
const { DOMAIN_EVENTS } = require('../events/domainEvents');
const crypto = require('crypto');

/**
 * 🏥 Fase 19: CRM Clínico & Embudo de Leads a Pacientes
 */

// 1. Listar Leads con filtros y paginación
exports.getLeads = async (req, res) => {
  try {
    const { role, organizationId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const effectiveOrgId = isSuperAdmin ? (req.query.organizationId || organizationId) : organizationId;

    const where = {};
    if (effectiveOrgId) {
      where.organizationId = effectiveOrgId;
    }

    const { status, source, specialtyId, assignedUserId, search } = req.query;

    if (status) where.status = status;
    if (source) where.source = source;
    if (specialtyId) where.specialtyId = specialtyId;
    if (assignedUserId) where.assignedUserId = assignedUserId;

    if (search && search.trim()) {
      const s = search.trim();
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${s}%` } },
        { lastName: { [Op.iLike]: `%${s}%` } },
        { phone: { [Op.iLike]: `%${s}%` } },
        { email: { [Op.iLike]: `%${s}%` } },
        { documentId: { [Op.iLike]: `%${s}%` } }
      ];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const { count, rows } = await Lead.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Specialty, attributes: ['id', 'name'] },
        { 
          model: Patient, 
          as: 'convertedPatient', 
          attributes: ['id', 'medicalRecordNumber', 'documentId'],
          include: [{ model: User, attributes: ['firstName', 'lastName'] }]
        }
      ]
    });

    res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      leads: rows
    });
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    res.status(500).json({ error: error.message });
  }
};

// 2. Métricas y Analytics del Embudo (Funnel)
exports.getLeadStats = async (req, res) => {
  try {
    const { role, organizationId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const effectiveOrgId = isSuperAdmin ? (req.query.organizationId || organizationId) : organizationId;

    const orgFilter = effectiveOrgId ? { organizationId: effectiveOrgId } : {};

    const leads = await Lead.findAll({
      where: orgFilter,
      attributes: ['status', 'source', 'estimatedValue']
    });

    const funnel = {
      total: leads.length,
      new: 0,
      contacted: 0,
      scheduled: 0,
      converted: 0,
      lost: 0
    };

    const sources = {};
    let totalEstimatedValue = 0;
    let convertedValue = 0;

    leads.forEach(l => {
      const st = l.status;
      if (st === 'NEW') funnel.new++;
      else if (st === 'CONTACTED') funnel.contacted++;
      else if (st === 'SCHEDULED') funnel.scheduled++;
      else if (st === 'CONVERTED') funnel.converted++;
      else if (st === 'LOST') funnel.lost++;

      const src = l.source || 'OTHER';
      sources[src] = (sources[src] || 0) + 1;

      const val = parseFloat(l.estimatedValue) || 0;
      totalEstimatedValue += val;
      if (st === 'CONVERTED') {
        convertedValue += val;
      }
    });

    const conversionRatePercent = funnel.total > 0
      ? parseFloat(((funnel.converted / funnel.total) * 100).toFixed(1))
      : 0;

    res.json({
      organizationId: effectiveOrgId || null,
      funnel,
      conversionRatePercent,
      sources,
      financials: {
        totalEstimatedValue: totalEstimatedValue.toFixed(2),
        convertedValue: convertedValue.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching CRM lead stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// 3. Detalle de un Lead
exports.getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, organizationId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const lead = await Lead.findByPk(id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Specialty, attributes: ['id', 'name'] },
        { 
          model: Patient, 
          as: 'convertedPatient', 
          attributes: ['id', 'medicalRecordNumber', 'documentId']
        }
      ]
    });

    if (!lead) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    if (!isSuperAdmin && lead.organizationId && lead.organizationId !== organizationId) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead by id:', error);
    res.status(500).json({ error: error.message });
  }
};

// 4. Crear Prospecto / Lead
exports.createLead = async (req, res) => {
  try {
    const { role, organizationId, id: userId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const effectiveOrgId = isSuperAdmin ? (req.body.organizationId || organizationId) : organizationId;

    const {
      firstName,
      lastName,
      phone,
      email,
      documentId,
      source,
      channel,
      specialtyId,
      assignedUserId,
      estimatedValue,
      notes,
      tags
    } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ message: 'Nombre, apellido y teléfono son requeridos' });
    }

    const lead = await Lead.create({
      organizationId: effectiveOrgId || null,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : null,
      documentId: documentId ? documentId.trim().toUpperCase() : null,
      source: source || 'WHATSAPP',
      status: 'NEW',
      channel: channel || null,
      specialtyId: specialtyId || null,
      assignedUserId: assignedUserId || null,
      estimatedValue: estimatedValue || 0.00,
      notes: notes || null,
      tags: tags || []
    });

    // Publicar evento en EventBus
    try {
      eventBus.publish('crm.leadCreated', {
        leadId: lead.id,
        organizationId: lead.organizationId,
        source: lead.source,
        createdBy: userId
      }, {
        organizationId: lead.organizationId,
        userId
      });
    } catch (e) {
      // Non-blocking
    }

    res.status(201).json(lead);
  } catch (error) {
    console.error('Error creating CRM lead:', error);
    res.status(500).json({ error: error.message });
  }
};

// 5. Actualizar Estado o Seguimiento del Lead
exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, organizationId, id: userId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    if (!isSuperAdmin && lead.organizationId && lead.organizationId !== organizationId) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    const {
      status,
      assignedUserId,
      specialtyId,
      lossReason,
      notes,
      estimatedValue,
      channel,
      phone,
      email,
      documentId
    } = req.body;

    const previousStatus = lead.status;

    if (status) lead.status = status;
    if (assignedUserId !== undefined) lead.assignedUserId = assignedUserId;
    if (specialtyId !== undefined) lead.specialtyId = specialtyId;
    if (lossReason !== undefined) lead.lossReason = lossReason;
    if (notes !== undefined) lead.notes = notes;
    if (estimatedValue !== undefined) lead.estimatedValue = estimatedValue;
    if (channel !== undefined) lead.channel = channel;
    if (phone) lead.phone = phone.trim();
    if (email !== undefined) lead.email = email ? email.trim().toLowerCase() : null;
    if (documentId !== undefined) lead.documentId = documentId ? documentId.trim().toUpperCase() : null;

    await lead.save();

    // Si cambió de estado, notificar en el bus
    if (status && status !== previousStatus) {
      try {
        eventBus.publish('crm.leadStatusChanged', {
          leadId: lead.id,
          previousStatus,
          newStatus: status,
          organizationId: lead.organizationId,
          updatedBy: userId
        }, {
          organizationId: lead.organizationId,
          userId
        });
      } catch (e) {
        // Non-blocking
      }
    }

    res.json(lead);
  } catch (error) {
    console.error('Error updating CRM lead:', error);
    res.status(500).json({ error: error.message });
  }
};

// 6. Conversión de Lead a Paciente Activo
exports.convertLeadToPatient = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { role, organizationId, id: userId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const lead = await Lead.findByPk(id, { transaction });
    if (!lead) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    if (!isSuperAdmin && lead.organizationId && lead.organizationId !== organizationId) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    if (lead.status === 'CONVERTED' && lead.convertedPatientId) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'El prospecto ya fue convertido anteriormente a paciente',
        patientId: lead.convertedPatientId
      });
    }

    const effectiveOrgId = lead.organizationId || organizationId;

    // 1. Buscar o crear el rol PATIENT
    const [patientRole] = await Role.findOrCreate({
      where: { name: 'PATIENT' },
      defaults: { description: 'Paciente' },
      transaction
    });

    // 2. Buscar si ya existe un usuario por email o generar uno
    const emailToUse = lead.email || `lead_${lead.id.slice(0, 8)}@clinica-lead.local`;
    let user = await User.findOne({ where: { email: emailToUse }, transaction });

    if (!user) {
      user = await User.create({
        username: `pat_${Date.now()}_${lead.phone.replace(/[^0-9]/g, '').slice(-4)}`,
        email: emailToUse,
        password: crypto.randomBytes(16).toString('hex'), // Clave temporal segura
        firstName: lead.firstName,
        lastName: lead.lastName,
        roleId: patientRole.id,
        organizationId: effectiveOrgId,
        isActive: true
      }, { transaction });
    }

    // 3. Crear el registro en Patients
    const documentId = lead.documentId || `V-${Date.now().toString().slice(-8)}`;
    const medicalRecordNumber = `HC-${effectiveOrgId ? effectiveOrgId.slice(0, 4) : 'GEN'}-${Date.now().toString().slice(-6)}`;

    let patient = await Patient.findOne({
      where: {
        userId: user.id,
        ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {})
      },
      transaction
    });

    if (!patient) {
      patient = await Patient.create({
        userId: user.id,
        organizationId: effectiveOrgId,
        documentId,
        documentPrefix: 'V',
        documentNumber: documentId.replace(/[^0-9]/g, ''),
        medicalRecordNumber,
        phone: lead.phone
      }, { transaction });
    }

    // 4. Actualizar el Lead a CONVERTED
    lead.status = 'CONVERTED';
    lead.convertedPatientId = patient.id;
    lead.conversionDate = new Date();
    await lead.save({ transaction });

    await transaction.commit();

    // 5. Emitir eventos de dominio
    try {
      eventBus.publish('crm.leadConverted', {
        leadId: lead.id,
        patientId: patient.id,
        organizationId: effectiveOrgId,
        convertedBy: userId
      }, {
        organizationId: effectiveOrgId,
        userId
      });

      eventBus.publish(DOMAIN_EVENTS.PATIENTS.REGISTERED, {
        patientId: patient.id,
        organizationId: effectiveOrgId,
        source: 'CRM_CONVERSION'
      }, {
        organizationId: effectiveOrgId,
        userId
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({
      message: 'Prospecto convertido exitosamente a paciente activo',
      lead,
      patient: {
        id: patient.id,
        medicalRecordNumber: patient.medicalRecordNumber,
        documentId: patient.documentId,
        fullName: `${lead.firstName} ${lead.lastName}`.trim()
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error converting lead to patient:', error);
    res.status(500).json({ error: error.message });
  }
};

// 7. Eliminar Lead (Soft delete)
exports.deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, organizationId, id: userId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    if (!isSuperAdmin && lead.organizationId && lead.organizationId !== organizationId) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    lead.deletedBy = userId;
    await lead.save();
    await lead.destroy();

    res.json({ message: 'Prospecto eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting CRM lead:', error);
    res.status(500).json({ error: error.message });
  }
};
