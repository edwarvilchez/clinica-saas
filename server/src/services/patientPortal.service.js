'use strict';

/**
 * 🏥 PatientPortalService - Patient Self-Service & Anti-IDOR Protected Healthcare Portal
 * Implements Phase 23: Principle of least privilege for patients, secure profile access,
 * self-appointment scheduling/cancellation, verified lab results, digital prescriptions,
 * payment receipts, and digital health card.
 */

const { Op } = require('sequelize');
const {
  Patient,
  User,
  Doctor,
  Specialty,
  Appointment,
  LabResult,
  Prescription,
  MedicalRecord,
  Payment,
  InsuranceCompany,
  sequelize
} = require('../models');
const auditService = require('./audit.service');
const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
const { validateAppointment } = require('../utils/appointmentValidator');
const logger = require('../utils/logger');

class PatientPortalService {
  /**
   * Helper: Resolves and verifies patient record from authenticated user
   */
  async getPatientForUser(userId, organizationId = null) {
    const where = { userId };
    if (organizationId) where.organizationId = organizationId;

    const patient = await Patient.findOne({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId', 'isActive']
        },
        {
          model: InsuranceCompany,
          attributes: ['id', 'name', 'rif', 'phone']
        }
      ]
    });

    if (!patient) {
      const err = new Error('Perfil de paciente no encontrado');
      err.statusCode = 404;
      throw err;
    }

    return patient;
  }

  /**
   * 1. Get authenticated patient's personal profile and health metadata
   */
  async getPatientProfile({ userId, organizationId = null, actorUserId = null, ip = null }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    // Audit access
    await auditService.logEvent({
      action: 'PORTAL_PROFILE_ACCESSED',
      entity: 'Patient',
      entityId: patient.id,
      organizationId: patient.organizationId,
      actorUserId: actorUserId || userId,
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[PatientPortal] Audit profile accessed failed' }));

    return {
      id: patient.id,
      medicalRecordNumber: patient.medicalRecordNumber,
      documentId: patient.documentId,
      documentType: patient.documentType,
      firstName: patient.User?.firstName,
      lastName: patient.User?.lastName,
      email: patient.User?.email,
      phone: patient.phone,
      birthDate: patient.birthDate,
      gender: patient.gender,
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      address: patient.address,
      state: patient.state,
      city: patient.city,
      municipality: patient.municipality,
      hasInsurance: patient.hasInsurance,
      insuranceProvider: patient.insuranceProvider,
      policyNumber: patient.policyNumber,
      coverageType: patient.coverageType,
      coverageStatus: patient.coverageStatus,
      copayPercentage: patient.copayPercentage,
      familyInfo: patient.familyInfo || [],
      preexistingDiseases: patient.preexistingDiseases || [],
      organizationId: patient.organizationId
    };
  }

  /**
   * 2. Self-service profile update (non-sensitive demographic fields only)
   */
  async updatePatientProfile({ userId, organizationId = null, updateData = {}, actorUserId = null, ip = null }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    // Filter allowed fields only - prevent tampering with clinical/identifier keys
    const allowedFields = [
      'phone',
      'address',
      'state',
      'city',
      'municipality',
      'allergies',
      'familyInfo'
    ];

    const changes = {};
    const oldValues = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined && updateData[field] !== patient[field]) {
        oldValues[field] = patient[field];
        changes[field] = updateData[field];
        patient[field] = updateData[field];
      }
    }

    if (Object.keys(changes).length > 0) {
      await patient.save();

      // Audit Log
      await auditService.logEvent({
        action: 'PORTAL_PROFILE_UPDATED',
        entity: 'Patient',
        entityId: patient.id,
        organizationId: patient.organizationId,
        actorUserId: actorUserId || userId,
        oldValues,
        newValues: changes,
        ip
      }).catch(e => logger.warn({ err: e.message, msg: '[PatientPortal] Audit profile update failed' }));

      // Domain Event
      eventBus.publish(DOMAIN_EVENTS.PORTAL_PROFILE_UPDATED, {
        patientId: patient.id,
        updatedFields: Object.keys(changes)
      }, {
        organizationId: patient.organizationId,
        userId: actorUserId || userId
      });
    }

    return await this.getPatientProfile({ userId, organizationId });
  }

  /**
   * 3. Get patient's appointment history and upcoming appointments
   */
  async getPatientAppointments({ userId, organizationId = null, status = null, page = 1, limit = 20 }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    const where = {
      patientId: patient.id
    };
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;

    const offset = (Math.max(1, page) - 1) * limit;

    const { count, rows } = await Appointment.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          model: Doctor,
          attributes: ['id', 'licenseNumber'],
          include: [
            { model: User, attributes: ['id', 'firstName', 'lastName'] },
            { model: Specialty, attributes: ['id', 'name', 'code'] }
          ]
        }
      ],
      order: [['date', 'DESC']]
    });

    const now = new Date();
    const upcoming = [];
    const past = [];

    for (const appt of rows) {
      const apptDate = new Date(appt.date);
      if (apptDate >= now && !['Cancelled', 'NoShow'].includes(appt.status)) {
        upcoming.push(appt);
      } else {
        past.push(appt);
      }
    }

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      upcoming,
      past,
      appointments: rows
    };
  }

  /**
   * 4. Patient self-booking with conflict checks
   */
  async bookAppointment({
    userId,
    organizationId = null,
    doctorId,
    date,
    reason,
    notes = null,
    actorUserId = null,
    ip = null
  }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    if (!doctorId || !date) {
      const err = new Error('doctorId y date son obligatorios para agendar cita');
      err.statusCode = 400;
      throw err;
    }

    const apptDate = new Date(date);
    if (isNaN(apptDate.getTime()) || apptDate <= new Date()) {
      const err = new Error('La fecha de la cita debe ser futura y válida');
      err.statusCode = 400;
      throw err;
    }

    // Verify doctor exists in same organization
    const doctor = await Doctor.findOne({
      where: {
        id: doctorId,
        ...(patient.organizationId ? { organizationId: patient.organizationId } : {})
      },
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName'] },
        { model: Specialty, attributes: ['id', 'name'] }
      ]
    });

    if (!doctor) {
      const err = new Error('Médico no disponible en esta organización');
      err.statusCode = 404;
      throw err;
    }

    // Scheduling conflict validation
    const conflict = await validateAppointment(doctorId, patient.id, apptDate);
    if (!conflict.valid) {
      const err = new Error('El horario seleccionado no está disponible');
      err.statusCode = 409;
      throw err;
    }

    const appointment = await Appointment.create({
      patientId: patient.id,
      doctorId,
      date: apptDate,
      reason: reason || 'Consulta agendada desde Portal del Paciente',
      notes: notes || 'Autogestión por Portal',
      status: 'Confirmed',
      organizationId: patient.organizationId
    });

    // Audit Log
    await auditService.logEvent({
      action: 'PORTAL_APPOINTMENT_BOOKED',
      entity: 'Appointment',
      entityId: appointment.id,
      organizationId: patient.organizationId,
      actorUserId: actorUserId || userId,
      newValues: {
        patientId: patient.id,
        doctorId,
        date: apptDate,
        status: 'Confirmed'
      },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[PatientPortal] Audit booking failed' }));

    // Domain Events
    eventBus.publish(DOMAIN_EVENTS.APPOINTMENT_SCHEDULED, {
      appointmentId: appointment.id,
      patientId: patient.id,
      doctorId,
      date: apptDate,
      reason: appointment.reason
    }, {
      organizationId: patient.organizationId,
      userId: actorUserId || userId
    });

    eventBus.publish(DOMAIN_EVENTS.PORTAL_APPOINTMENT_BOOKED, {
      appointmentId: appointment.id,
      patientId: patient.id,
      doctorId,
      date: apptDate
    }, {
      organizationId: patient.organizationId,
      userId: actorUserId || userId
    });

    return await Appointment.findByPk(appointment.id, {
      include: [
        {
          model: Doctor,
          include: [
            { model: User, attributes: ['id', 'firstName', 'lastName'] },
            { model: Specialty, attributes: ['id', 'name'] }
          ]
        }
      ]
    });
  }

  /**
   * 5. Patient self-service appointment cancellation (Anti-IDOR protected)
   */
  async cancelAppointment({
    userId,
    organizationId = null,
    appointmentId,
    reason = 'Cancelado por el paciente',
    actorUserId = null,
    ip = null
  }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    const where = { id: appointmentId };
    if (organizationId) where.organizationId = organizationId;

    const appointment = await Appointment.findOne({ where });

    if (!appointment) {
      const err = new Error('Cita médica no encontrada');
      err.statusCode = 404;
      throw err;
    }

    // Strict Anti-IDOR check
    if (appointment.patientId !== patient.id) {
      const err = new Error('Acceso denegado: no puedes cancelar citas de otros pacientes');
      err.statusCode = 403;
      throw err;
    }

    if (appointment.status === 'Cancelled') {
      const err = new Error('La cita ya se encuentra cancelada');
      err.statusCode = 400;
      throw err;
    }

    if (appointment.status === 'Completed') {
      const err = new Error('No es posible cancelar una cita que ya ha sido completada');
      err.statusCode = 400;
      throw err;
    }

    const oldStatus = appointment.status;
    appointment.status = 'Cancelled';
    appointment.notes = appointment.notes
      ? `${appointment.notes} | Cancelada por paciente: ${reason}`
      : `Cancelada por paciente: ${reason}`;
    await appointment.save();

    // Audit Log
    await auditService.logEvent({
      action: 'PORTAL_APPOINTMENT_CANCELLED',
      entity: 'Appointment',
      entityId: appointment.id,
      organizationId: appointment.organizationId,
      actorUserId: actorUserId || userId,
      oldValues: { status: oldStatus },
      newValues: { status: 'Cancelled', reason },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[PatientPortal] Audit cancel failed' }));

    // Domain Events
    eventBus.publish(DOMAIN_EVENTS.APPOINTMENT_CANCELLED, {
      appointmentId: appointment.id,
      patientId: patient.id,
      doctorId: appointment.doctorId,
      reason
    }, {
      organizationId: appointment.organizationId,
      userId: actorUserId || userId
    });

    eventBus.publish(DOMAIN_EVENTS.PORTAL_APPOINTMENT_CANCELLED, {
      appointmentId: appointment.id,
      patientId: patient.id,
      reason
    }, {
      organizationId: appointment.organizationId,
      userId: actorUserId || userId
    });

    return appointment;
  }

  /**
   * 6. Get completed, verified laboratory reports (Anti-IDOR protected)
   */
  async getPatientLabResults({ userId, organizationId = null, page = 1, limit = 20 }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    const where = {
      patientId: patient.id,
      status: 'Completed' // Only verified completed results are visible to patients
    };
    if (organizationId) where.organizationId = organizationId;

    const offset = (Math.max(1, page) - 1) * limit;

    const { count, rows } = await LabResult.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      results: rows
    };
  }

  /**
   * 7. Get digital prescriptions issued to this patient
   */
  async getPatientPrescriptions({ userId, organizationId = null, status = 'active' }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    const where = {};
    if (status) where.status = status;
    if (organizationId) where.organizationId = organizationId;

    const prescriptions = await Prescription.findAll({
      where,
      include: [
        {
          model: MedicalRecord,
          where: { patientId: patient.id },
          attributes: ['id', 'patientId', 'doctorId', 'createdAt'],
          include: [
            {
              model: Doctor,
              attributes: ['id', 'licenseNumber'],
              include: [
                { model: User, attributes: ['id', 'firstName', 'lastName'] },
                { model: Specialty, attributes: ['id', 'name'] }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return prescriptions;
  }

  /**
   * 8. Get patient billing receipts and payment history (Anti-IDOR protected)
   */
  async getPatientPayments({ userId, organizationId = null, page = 1, limit = 20 }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    const where = {
      patientId: patient.id
    };
    if (organizationId) where.organizationId = organizationId;

    const offset = (Math.max(1, page) - 1) * limit;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      limit,
      offset,
      attributes: [
        'id', 'amount', 'amountBs', 'method', 'currency',
        'status', 'concept', 'reference', 'receiptUrl', 'createdAt'
      ],
      order: [['createdAt', 'DESC']]
    });

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      payments: rows
    };
  }

  /**
   * 9. Consolidated Digital Health Card / Passport
   */
  async getDigitalHealthCard({ userId, organizationId = null }) {
    const patient = await this.getPatientForUser(userId, organizationId);

    // Active prescriptions count
    const activePrescriptionsCount = await Prescription.count({
      where: { status: 'active' },
      include: [
        {
          model: MedicalRecord,
          where: { patientId: patient.id }
        }
      ]
    });

    // Last completed appointment
    const lastAppointment = await Appointment.findOne({
      where: {
        patientId: patient.id,
        status: 'Completed'
      },
      include: [
        {
          model: Doctor,
          include: [
            { model: User, attributes: ['firstName', 'lastName'] },
            { model: Specialty, attributes: ['name'] }
          ]
        }
      ],
      order: [['date', 'DESC']]
    });

    return {
      cardId: patient.id,
      patientName: `${patient.User?.firstName} ${patient.User?.lastName}`,
      documentId: patient.documentId,
      medicalRecordNumber: patient.medicalRecordNumber,
      bloodType: patient.bloodType || 'No registrado',
      allergies: patient.allergies || 'Ninguna registrada',
      preexistingDiseases: patient.preexistingDiseases || [],
      insurance: {
        hasInsurance: patient.hasInsurance,
        provider: patient.insuranceProvider || 'Particular',
        policyNumber: patient.policyNumber,
        coverageStatus: patient.coverageStatus
      },
      emergencyContact: patient.familyInfo?.[0] || null,
      activePrescriptionsCount,
      lastConsultation: lastAppointment ? {
        date: lastAppointment.date,
        doctor: `${lastAppointment.Doctor?.User?.firstName} ${lastAppointment.Doctor?.User?.lastName}`,
        specialty: lastAppointment.Doctor?.Specialty?.name
      } : null,
      issuedAt: new Date().toISOString()
    };
  }
}

module.exports = new PatientPortalService();
