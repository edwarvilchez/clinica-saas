const { VideoConsultation, User, Appointment, Doctor, Patient } = require('../models');
const { v4: uuidv4 } = require('uuid');

const validateAppointmentAccess = async (appointmentId, organizationId, role) => {
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
  if (isSuperAdmin) return true;

  const appointment = await Appointment.findByPk(appointmentId, {
    include: [
      { model: Patient, include: [{ model: User, attributes: ['organizationId'] }] },
      { model: Doctor, include: [{ model: User, attributes: ['organizationId'] }] }
    ]
  });

  if (!appointment) return false;

  const patientOrgId = appointment.Patient?.User?.organizationId;
  const doctorOrgId = appointment.Doctor?.User?.organizationId;

  return patientOrgId === organizationId || doctorOrgId === organizationId;
};

// Crear sala de videoconsulta
exports.createVideoConsultation = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { appointmentId } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({ message: 'appointmentId es requerido' });
    }

    const hasAccess = await validateAppointmentAccess(appointmentId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a esta cita' });
    }

    // Verificar que la cita existe
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        { 
          model: Patient, 
          include: [{ model: User }]
        },
        {
          model: Doctor,
          include: [{ model: User }]
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Cita no encontrada' });
    }

    // Obtener los User IDs
    const patientUserId = appointment.Patient?.User?.id;
    const doctorUserId = appointment.Doctor?.User?.id;

    if (!patientUserId || !doctorUserId) {
      return res.status(400).json({ message: 'La cita no tiene asociados correctamente al paciente o doctor' });
    }

    // Verificar que no exista ya una videoconsulta para esta cita
    // Forzamos el tipo de appointmentId para evitar errores de casting
    const existing = await VideoConsultation.findOne({ 
      where: { appointmentId: appointmentId.toString() } 
    });

    if (existing) {
      return res.status(200).json({
        message: 'Videoconsulta ya existe',
        videoConsultation: existing
      });
    }

    // Generar ID único para la sala
    const roomId = uuidv4();

    const videoConsultation = await VideoConsultation.create({
      appointmentId,
      doctorId: doctorUserId,
      patientId: patientUserId,
      roomId,
      status: 'scheduled'
    });

    console.log(`✅ Videoconsulta creada: ${roomId} (ID: ${videoConsultation.id})`);

    res.status(201).json({
      message: 'Videoconsulta creada exitosamente',
      videoConsultation
    });
  } catch (error) {
    console.error('❌ Error creando videoconsulta:', error);
    res.status(500).json({ 
      message: 'Error del servidor al crear videoconsulta', 
      error: error.message 
    });
  }
};

// Obtener videoconsulta por ID
exports.getVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id === 'NaN' || id === 'undefined') {
      return res.status(400).json({ message: 'ID de videoconsulta inválido' });
    }
    // Soportar: (1) id numérico (PK) o (2) roomId (UUID/string) en la misma ruta.
    // Evita errores cuando el frontend pasa el roomId en lugar del ID numérico.
    let videoConsultation = null;
    const isNumericId = /^\d+$/.test(String(id));

    if (isNumericId) {
      // Buscar por PK numérico
      videoConsultation = await VideoConsultation.findByPk(id, {
        include: [
          { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Appointment, attributes: ['id', 'date', 'reason', 'status'] }
        ]
      });
    } else {
      // Buscar por roomId cuando se recibe un UUID/string
      videoConsultation = await VideoConsultation.findOne({
        where: { roomId: id },
        include: [
          { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Appointment, attributes: ['id', 'date', 'reason', 'status'] }
        ]
      });
    }

    if (!videoConsultation) {
      return res.status(404).json({ message: 'Videoconsulta no encontrada' });
    }

    res.json(videoConsultation);
  } catch (error) {
    const fs = require('fs');
    fs.appendFileSync('server_error.log', `[${new Date().toISOString()}] Error getting VC ${id}: ${error.stack}\n`);
    console.error(`❌ Error obteniendo videoconsulta ${req.params.id}:`, error);
    res.status(500).json({ message: 'Error del servidor al obtener videoconsulta', error: error.message });
  }
};

// Obtener videoconsulta por roomId
exports.getVideoConsultationByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const videoConsultation = await VideoConsultation.findOne({
      where: { roomId },
      include: [
        { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName'] },
        { model: Appointment }
      ]
    });

    if (!videoConsultation) {
      return res.status(404).json({ message: 'Sala no encontrada' });
    }

    res.json(videoConsultation);
  } catch (error) {
    console.error('❌ Error obteniendo videoconsulta por sala:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Iniciar videoconsulta
exports.startVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;

    const videoConsultation = await VideoConsultation.findByPk(id);
    if (!videoConsultation) {
      return res.status(404).json({ message: 'Videoconsulta no encontrada' });
    }

    if (videoConsultation.status === 'active') {
      return res.json({
        message: 'Videoconsulta ya está activa',
        videoConsultation
      });
    }

    videoConsultation.status = 'active';
    videoConsultation.startTime = new Date();
    await videoConsultation.save();

    console.log(`▶️ Videoconsulta iniciada: ${videoConsultation.roomId}`);

    res.json({
      message: 'Videoconsulta iniciada',
      videoConsultation
    });
  } catch (error) {
    console.error('❌ Error iniciando videoconsulta:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Finalizar videoconsulta
exports.endVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const videoConsultation = await VideoConsultation.findByPk(id);
    if (!videoConsultation) {
      return res.status(404).json({ message: 'Videoconsulta no encontrada' });
    }

    if (videoConsultation.status === 'completed') {
      return res.json({
        message: 'Videoconsulta ya fue finalizada',
        videoConsultation
      });
    }

    const endTime = new Date();
    const startTime = new Date(videoConsultation.startTime);
    const duration = videoConsultation.startTime 
      ? Math.round((endTime - startTime) / 60000) // minutos
      : 0;

    videoConsultation.status = 'completed';
    videoConsultation.endTime = endTime;
    videoConsultation.duration = duration;
    videoConsultation.notes = notes || null;
    await videoConsultation.save();

    console.log(`⏹️ Videoconsulta finalizada: ${videoConsultation.roomId} (${duration} min)`);

    res.json({
      message: 'Videoconsulta finalizada',
      videoConsultation
    });
  } catch (error) {
    console.error('❌ Error finalizando videoconsulta:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Listar videoconsultas del doctor
exports.getDoctorVideoConsultations = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const consultations = await VideoConsultation.findAll({
      where: { doctorId },
      include: [
        { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Appointment, attributes: ['id', 'date', 'status'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(consultations);
  } catch (error) {
    console.error('❌ Error obteniendo videoconsultas del doctor:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Listar videoconsultas del paciente
exports.getPatientVideoConsultations = async (req, res) => {
  try {
    const patientId = req.user.id;

    const consultations = await VideoConsultation.findAll({
      where: { patientId },
      include: [
        { 
          model: User, 
          as: 'doctor', 
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{ model: Doctor, attributes: ['licenseNumber'] }]
        },
        { model: Appointment, attributes: ['id', 'date', 'status'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(consultations);
  } catch (error) {
    console.error('❌ Error obteniendo videoconsultas del paciente:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// Cancelar videoconsulta
exports.cancelVideoConsultation = async (req, res) => {
  try {
    const { id } = req.params;

    const videoConsultation = await VideoConsultation.findByPk(id);
    if (!videoConsultation) {
      return res.status(404).json({ message: 'Videoconsulta no encontrada' });
    }

    if (videoConsultation.status === 'completed') {
      return res.status(400).json({ message: 'No se puede cancelar una videoconsulta completada' });
    }

    videoConsultation.status = 'cancelled';
    await videoConsultation.save();

    console.log(`🚫 Videoconsulta cancelada: ${videoConsultation.roomId}`);

    res.json({
      message: 'Videoconsulta cancelada',
      videoConsultation
    });
  } catch (error) {
    console.error('❌ Error cancelando videoconsulta:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};
