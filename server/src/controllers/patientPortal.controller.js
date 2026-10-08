'use strict';

/**
 * ⚡ PatientPortalController - HTTP Endpoints for Patient Self-Service Portal
 */

const patientPortalService = require('../services/patientPortal.service');

exports.getProfile = async (req, res) => {
  try {
    const profile = await patientPortalService.getPatientProfile({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.json(profile);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updated = await patientPortalService.updatePatientProfile({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      updateData: req.body,
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.json({
      message: 'Perfil de paciente actualizado exitosamente',
      profile: updated
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const appointments = await patientPortalService.getPatientAppointments({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.json(appointments);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const { doctorId, date, reason, notes } = req.body;
    const appt = await patientPortalService.bookAppointment({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      doctorId,
      date,
      reason,
      notes,
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.status(201).json({
      message: 'Cita médica agendada exitosamente',
      appointment: appt
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const cancelled = await patientPortalService.cancelAppointment({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      appointmentId: id,
      reason,
      actorUserId: req.user.id,
      ip: req.ip
    });
    res.json({
      message: 'Cita cancelada exitosamente',
      appointment: cancelled
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getLabResults = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const results = await patientPortalService.getPatientLabResults({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.json(results);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getPrescriptions = async (req, res) => {
  try {
    const { status } = req.query;
    const prescriptions = await patientPortalService.getPatientPrescriptions({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      status: status || 'active'
    });
    res.json(prescriptions);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const payments = await patientPortalService.getPatientPayments({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.json(payments);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getHealthCard = async (req, res) => {
  try {
    const card = await patientPortalService.getDigitalHealthCard({
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    res.json(card);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};
