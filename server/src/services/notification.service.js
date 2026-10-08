'use strict';

/**
 * 🔔 NotificationService - Multi-Channel Communication Service
 * Unified domain notification abstraction for WhatsApp, Email, and SMS/Push.
 * Decouples clinical workflows from specific delivery providers (Twilio, Resend, Nodemailer).
 */

const whatsapp = require('../utils/whatsapp.service');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.appName = process.env.APP_NAME || 'Clínica SaaS';
    this.clientUrl = process.env.CLIENT_URL || 'https://clinicasaas.app';
  }

  /**
   * Helper to format human-readable appointment dates
   */
  _formatDateInfo(dateInput) {
    const d = new Date(dateInput);
    const dateStr = d.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return { dateStr, timeStr, rawDate: d };
  }

  /**
   * Extract patient and doctor details from appointment object
   */
  _extractAppointmentDetails(appointment) {
    const patientUser = appointment?.Patient?.User || {};
    const doctorUser = appointment?.Doctor?.User || {};
    const patientName = `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Paciente';
    const doctorName = `${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() || 'Médico Especialista';
    const patientPhone = appointment?.Patient?.phone || patientUser.phone || '';
    const patientEmail = patientUser.email || '';
    const specialtyName = appointment?.Doctor?.Specialty?.name || appointment?.reason || 'Consulta Médica';

    const { dateStr, timeStr, rawDate } = this._formatDateInfo(appointment.date);

    return {
      appointmentId: appointment.id,
      patientName,
      doctorName,
      patientPhone,
      patientEmail,
      specialtyName,
      date: dateStr,
      time: timeStr,
      rawDate,
      organizationId: appointment.organizationId
    };
  }

  /**
   * Send appointment reminder (24h or immediate) across configured channels
   */
  async sendAppointmentReminder(appointment, options = {}) {
    const details = this._extractAppointmentDetails(appointment);
    const reminderType = options.type || '24h';
    const results = {
      appointmentId: details.appointmentId,
      reminderType,
      channels: {
        whatsapp: { success: false },
        email: { success: false }
      }
    };

    // 1. WhatsApp Delivery
    if (details.patientPhone) {
      try {
        if (reminderType === '24h') {
          const waRes = await whatsapp.send24hAppointmentReminder(details.patientPhone, details);
          results.channels.whatsapp = { success: !!waRes?.success, provider: waRes?.provider || 'simulation' };
        } else {
          const waRes = await whatsapp.sendAppointmentReminder(details.patientPhone, details);
          results.channels.whatsapp = { success: !!waRes?.success, provider: waRes?.provider || 'simulation' };
        }
      } catch (err) {
        logger.warn({
          err: err.message,
          appointmentId: details.appointmentId,
          msg: '[NotificationService] WhatsApp reminder failed to dispatch'
        });
        results.channels.whatsapp = { success: false, error: err.message };
      }
    }

    // 2. Email Delivery
    if (details.patientEmail) {
      try {
        const subject = reminderType === '24h'
          ? `Recordatorio: Tu cita médica es mañana - ${this.appName}`
          : `Recordatorio de cita médica próxima - ${this.appName}`;

        const html = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
            <h2 style="color: #2b6cb0; margin-top: 0;">🔔 Recordatorio de Cita Médica</h2>
            <p>Hola <strong>${details.patientName}</strong>,</p>
            <p>Te recordamos que tienes una cita médica programada en <strong>${this.appName}</strong>:</p>
            <div style="background-color: #f7fafc; border-left: 4px solid #3182ce; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 4px 0;">📅 <strong>Fecha:</strong> ${details.date}</p>
              <p style="margin: 4px 0;">⏰ <strong>Hora:</strong> ${details.time}</p>
              <p style="margin: 4px 0;">👨‍⚕️ <strong>Profesional:</strong> Dr. ${details.doctorName}</p>
              <p style="margin: 4px 0;">🩺 <strong>Especialidad/Motivo:</strong> ${details.specialtyName}</p>
            </div>
            <p>Por favor preséntate 10 minutos antes de la hora indicada.</p>
            <div style="margin: 24px 0; text-align: center;">
              <a href="${this.clientUrl}/appointments" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Ver y Gestionar mi Cita
              </a>
            </div>
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 24px 0;" />
            <p style="font-size: 12px; color: #718096; text-align: center;">
              Este es un mensaje automático de recordatorio generado por ${this.appName}.
            </p>
          </div>
        `;

        await sendEmail({
          email: details.patientEmail,
          subject,
          html,
          message: `Recordatorio de cita médica para ${details.patientName} el ${details.date} a las ${details.time} con Dr. ${details.doctorName}.`
        });

        results.channels.email = { success: true };
      } catch (err) {
        logger.warn({
          err: err.message,
          appointmentId: details.appointmentId,
          msg: '[NotificationService] Email reminder delivery failed'
        });
        results.channels.email = { success: false, error: err.message };
      }
    }

    results.success = results.channels.whatsapp.success || results.channels.email.success || false;
    return results;
  }

  /**
   * Send No-Show notice and rescheduling invite
   */
  async sendNoShowNotice(appointment, options = {}) {
    const details = this._extractAppointmentDetails(appointment);
    const results = {
      appointmentId: details.appointmentId,
      notice: 'NO_SHOW',
      channels: {
        whatsapp: { success: false },
        email: { success: false }
      }
    };

    // 1. WhatsApp Delivery
    if (details.patientPhone) {
      try {
        const message = `📋 *Aviso de Inasistencia a Cita Médica*\n\nHola ${details.patientName}, notamos que no pudiste asistir a tu cita del *${details.date} a las ${details.time}* con el Dr. ${details.doctorName}.\n\nTu salud es nuestra prioridad. Puedes volver a agendar fácilmente tu cita en el siguiente enlace:\n${this.clientUrl}/appointments\n\n¡Esperamos verte pronto!`;
        const waRes = await whatsapp._sendMessage(details.patientPhone, message);
        results.channels.whatsapp = { success: !!waRes?.success };
      } catch (err) {
        logger.warn({ err: err.message, appointmentId: details.appointmentId, msg: '[NotificationService] WhatsApp No-Show notice failed' });
      }
    }

    // 2. Email Delivery
    if (details.patientEmail) {
      try {
        const subject = `Aviso de inasistencia y reprogramación de cita - ${this.appName}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #c53030;">Aviso de Inasistencia a Cita</h2>
            <p>Estimado/a <strong>${details.patientName}</strong>,</p>
            <p>Notamos que no pudiste asistir a tu cita programada el <strong>${details.date} a las ${details.time}</strong> con el Dr. <strong>${details.doctorName}</strong>.</p>
            <p>Entendemos que pueden surgir imprevistos. Te invitamos a reprogramar tu consulta cuando gustes:</p>
            <div style="margin: 20px 0; text-align: center;">
              <a href="${this.clientUrl}/appointments" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Reprogramar Cita Médica
              </a>
            </div>
            <p style="font-size: 13px; color: #718096;">Si crees que esto es un error o necesitas asistencia adicional, contáctanos directamente en la clínica.</p>
          </div>
        `;

        await sendEmail({
          email: details.patientEmail,
          subject,
          html,
          message: `Aviso de inasistencia a cita médica del ${details.date}. Ingresa a ${this.clientUrl}/appointments para reprogramar.`
        });
        results.channels.email = { success: true };
      } catch (err) {
        logger.warn({ err: err.message, appointmentId: details.appointmentId, msg: '[NotificationService] Email No-Show notice failed' });
      }
    }

    results.success = results.channels.whatsapp.success || results.channels.email.success || false;
    return results;
  }

  /**
   * Send cancellation notification
   */
  async sendCancellationNotice(appointment) {
    const details = this._extractAppointmentDetails(appointment);
    if (details.patientPhone) {
      await whatsapp.sendCancellationNotice(details.patientPhone, {
        patientName: details.patientName,
        date: details.date,
        time: details.time
      }).catch(err => logger.warn({ err: err.message, msg: '[NotificationService] WhatsApp cancellation failed' }));
    }
  }
}

module.exports = new NotificationService();
