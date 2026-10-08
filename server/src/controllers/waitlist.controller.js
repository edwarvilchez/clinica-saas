'use strict';

/**
 * ⚡ WaitlistController - HTTP endpoints for Smart Waitlist
 */

const smartWaitlistService = require('../services/smartWaitlist.service');
const { Patient } = require('../models');

exports.addToWaitlist = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const isPatient = req.user?.role === 'PATIENT';
    const organizationId = isSuperAdmin ? (req.body.organizationId || req.user?.organizationId) : req.user?.organizationId;

    let patientId = req.body.patientId;

    // Anti-IDOR for patients: Patient role can only add themselves to waitlist
    if (isPatient) {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      if (!patient) {
        return res.status(404).json({ error: 'Perfil de paciente no encontrado' });
      }
      patientId = patient.id;
    }

    const {
      doctorId,
      specialtyId,
      priority,
      preferredDays,
      preferredTimeRange,
      notes
    } = req.body;

    const entry = await smartWaitlistService.addToWaitlist({
      organizationId,
      patientId,
      doctorId,
      specialtyId,
      priority: isPatient ? 'MEDIUM' : (priority || 'MEDIUM'), // Patients default to MEDIUM
      preferredDays,
      preferredTimeRange,
      notes,
      actorUserId: req.user?.id,
      ip: req.ip
    });

    res.status(201).json(entry);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getWaitlist = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const isPatient = req.user?.role === 'PATIENT';
    const organizationId = isSuperAdmin ? (req.query.organizationId || req.user?.organizationId) : req.user?.organizationId;

    let patientId = req.query.patientId;

    // Anti-IDOR: Patient can only view their own waitlist entries
    if (isPatient) {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      if (!patient) return res.json({ entries: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      patientId = patient.id;
    }

    const { status, specialtyId, doctorId, page, limit } = req.query;

    const result = await smartWaitlistService.getWaitlist({
      organizationId,
      status,
      specialtyId,
      doctorId,
      patientId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getWaitlistEntryById = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const isPatient = req.user?.role === 'PATIENT';
    const organizationId = isSuperAdmin ? null : req.user?.organizationId;

    const entry = await smartWaitlistService.getWaitlistById({ id, organizationId });

    if (isPatient && entry.Patient?.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acceso no autorizado a esta entrada de lista de espera' });
    }

    res.json(entry);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.offerSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? null : req.user?.organizationId;
    const { slotDate, expirationMinutes } = req.body;

    if (!slotDate) {
      return res.status(400).json({ error: 'slotDate es requerido para ofrecer un turno' });
    }

    const offered = await smartWaitlistService.offerSlotToCandidate({
      waitlistEntryId: id,
      organizationId,
      slotDate,
      expirationMinutes: parseInt(expirationMinutes) || 120,
      actorUserId: req.user?.id,
      ip: req.ip
    });

    res.json({
      message: 'Turno ofrecido exitosamente al candidato',
      entry: offered
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.acceptOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const isPatient = req.user?.role === 'PATIENT';
    const organizationId = isSuperAdmin ? null : req.user?.organizationId;

    const result = await smartWaitlistService.acceptOffer({
      waitlistEntryId: id,
      organizationId,
      patientUserId: isPatient ? req.user.id : null,
      actorUserId: req.user?.id,
      ip: req.ip
    });

    res.json({
      message: 'Oferta aceptada y cita médica programada exitosamente',
      ...result
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.declineOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const isPatient = req.user?.role === 'PATIENT';
    const organizationId = isSuperAdmin ? null : req.user?.organizationId;
    const { reason, keepInWaitlist } = req.body || {};

    const entry = await smartWaitlistService.declineOffer({
      waitlistEntryId: id,
      organizationId,
      patientUserId: isPatient ? req.user.id : null,
      reason: reason || 'PATIENT_DECLINED',
      keepInWaitlist: keepInWaitlist === true,
      actorUserId: req.user?.id,
      ip: req.ip
    });

    res.json({
      message: 'Oferta rechazada / cancelada',
      entry
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getWaitlistStats = async (req, res) => {
  try {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'PATIENT') {
      return res.status(403).json({ error: 'Acceso no autorizado a estadísticas operacionales de lista de espera' });
    }

    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.query.organizationId || req.user?.organizationId) : req.user?.organizationId;

    const stats = await smartWaitlistService.getWaitlistStats({ organizationId });
    res.json(stats);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.autoMatchSlot = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const organizationId = isSuperAdmin ? (req.body.organizationId || req.user?.organizationId) : req.user?.organizationId;
    const { doctorId, specialtyId, slotDate, expirationMinutes } = req.body;

    if (!slotDate) {
      return res.status(400).json({ error: 'slotDate es requerido para buscar coincidencia' });
    }

    const result = await smartWaitlistService.autoMatchOnSlotReleased({
      organizationId,
      doctorId,
      specialtyId,
      slotDate,
      expirationMinutes: parseInt(expirationMinutes) || 120
    });

    res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};
