'use strict';

/**
 * ⚡ VideoConsultationController - HTTP Handlers for Telemedicine & WebRTC
 * Refactored in Phase 26 to integrate TelemedicineService with strict Anti-IDOR,
 * token generation and audit logging.
 */

const telemedicineService = require('../services/telemedicine.service');

// 1. Crear sala de videoconsulta
exports.createVideoConsultation = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { appointmentId, doctorId, patientId } = req.body;

    const result = await telemedicineService.createConsultationRoom({
      appointmentId,
      doctorId,
      patientId,
      organizationId,
      actorUserId: req.user.id,
      ip: req.ip
    });

    res.status(result.created ? 201 : 200).json({
      message: result.created ? 'Videoconsulta creada exitosamente' : 'Videoconsulta ya existe',
      videoConsultation: result.videoConsultation
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 2. Generar token criptográfico de acceso a sala WebRTC (Anti-Eavesdropping Guard)
exports.getRoomAccessToken = async (req, res) => {
  try {
    const { roomId } = req.params;
    const tokenInfo = await telemedicineService.generateRoomAccessToken({
      roomId,
      userId: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
      actorUserId: req.user.id,
      ip: req.ip
    });

    res.json(tokenInfo);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 3. Obtener videoconsulta por ID o RoomID
exports.getVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const consultation = await telemedicineService.getConsultation({
      id,
      organizationId: req.user.organizationId,
      userId: req.user.id,
      role: req.user.role
    });

    res.json(consultation);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 4. Obtener videoconsulta por roomId
exports.getVideoConsultationByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const consultation = await telemedicineService.getConsultation({
      id: roomId,
      organizationId: req.user.organizationId,
      userId: req.user.id,
      role: req.user.role
    });

    res.json(consultation);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 5. Iniciar videoconsulta
exports.startVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const consultation = await telemedicineService.startSession({
      id,
      organizationId: req.user.organizationId,
      actorUserId: req.user.id,
      ip: req.ip
    });

    res.json({
      message: 'Videoconsulta iniciada',
      videoConsultation: consultation
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 6. Finalizar videoconsulta
exports.endVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const consultation = await telemedicineService.endSession({
      id,
      notes,
      organizationId: req.user.organizationId,
      actorUserId: req.user.id,
      ip: req.ip
    });

    res.json({
      message: 'Videoconsulta finalizada',
      videoConsultation: consultation
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 7. Cancelar videoconsulta
exports.cancelVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const consultation = await telemedicineService.cancelSession({
      id,
      reason,
      organizationId: req.user.organizationId,
      actorUserId: req.user.id,
      ip: req.ip
    });

    res.json({
      message: 'Videoconsulta cancelada',
      videoConsultation: consultation
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 8. Listar videoconsultas del doctor
exports.getDoctorVideoConsultations = async (req, res) => {
  try {
    const consultations = await telemedicineService.listConsultations({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      role: req.user.role,
      isDoctorFilter: true
    });

    res.json(consultations);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};

// 9. Listar videoconsultas del paciente
exports.getPatientVideoConsultations = async (req, res) => {
  try {
    const consultations = await telemedicineService.listConsultations({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      role: req.user.role,
      isPatientFilter: true
    });

    res.json(consultations);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message, error: error.message });
  }
};
