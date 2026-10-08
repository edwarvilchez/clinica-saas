'use strict';

/**
 * 📨 CommunicationsService - Unified Omnichannel Communications Abstraction
 * Implements Phase 25: Provider decoupling (Twilio, Meta Cloud, UltraMsg, Simulation),
 * delivery lifecycle tracking, webhook callbacks normalization, and multi-tenant message auditing.
 */

const { providerFactory } = require('./providers/WhatsAppProviderFactory');
const { CommunicationLog, Organization, sequelize } = require('../../models');
const auditService = require('../audit.service');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');
const logger = require('../../utils/logger');

class CommunicationsService {
  constructor() {
    this.factory = providerFactory;
  }

  /**
   * Core Message Dispatcher with Audit and Persistence
   */
  async sendMessage({
    to,
    message,
    channel = 'WHATSAPP',
    messageType = 'CUSTOM',
    organizationId = null,
    providerName = null,
    metadata = {},
    actorUserId = null,
    ip = null
  }) {
    if (!to || !message) {
      const err = new Error('Destinatario (to) y contenido del mensaje (message) son requeridos.');
      err.statusCode = 400;
      throw err;
    }

    const provider = this.factory.getProvider(providerName);
    const activeProviderName = provider.getName();

    let dispatchResult;
    try {
      dispatchResult = await provider.sendTextMessage({
        to,
        body: message,
        metadata: { ...metadata, organizationId }
      });
    } catch (sendError) {
      dispatchResult = {
        success: false,
        provider: activeProviderName,
        status: 'FAILED',
        error: sendError.message
      };
    }

    const status = dispatchResult.success ? (dispatchResult.status || 'SENT') : 'FAILED';
    const providerMessageId = dispatchResult.messageId || null;

    // Persist Delivery Log
    const log = await CommunicationLog.create({
      organizationId,
      channel,
      provider: activeProviderName,
      recipient: to,
      messageType,
      status,
      providerMessageId,
      content: message,
      errorMessage: dispatchResult.error || null,
      metadata: {
        ...metadata,
        dispatchResult: dispatchResult.rawResponse || null
      }
    });

    // Audit Log
    await auditService.logEvent({
      action: 'COMMUNICATION_SENT',
      entity: 'CommunicationLog',
      entityId: log.id,
      organizationId,
      actorUserId,
      newValues: { recipient: to, provider: activeProviderName, status },
      ip
    }).catch(e => logger.warn({ err: e.message, msg: '[CommunicationsService] Audit send failed' }));

    // Domain Event
    const eventName = dispatchResult.success ? DOMAIN_EVENTS.COMMUNICATION_SENT : DOMAIN_EVENTS.COMMUNICATION_FAILED;
    eventBus.publish(eventName, {
      logId: log.id,
      channel,
      provider: activeProviderName,
      recipient: to,
      messageType,
      status
    }, {
      organizationId,
      userId: actorUserId
    });

    return {
      success: dispatchResult.success,
      logId: log.id,
      provider: activeProviderName,
      status,
      providerMessageId,
      error: dispatchResult.error || null
    };
  }

  /**
   * Helper: Calendar link generator
   */
  _generateGoogleCalendarLink(title, dateStr, durationMinutes = 30, details = '') {
    const startDate = new Date(dateStr);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const formatDate = (date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');

    const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams({
      text: title,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details,
      location: 'Clínica SaaS'
    });

    return `${baseUrl}&${params.toString()}`;
  }

  /**
   * 1. Appointment Confirmation Notification
   */
  async sendAppointmentConfirmation({
    to,
    patientName,
    doctorName,
    date,
    time,
    appointmentId,
    rawDate = null,
    organizationId = null,
    providerName = null,
    actorUserId = null
  }) {
    const calendarLink = this._generateGoogleCalendarLink(
      `Cita Médica - Dr. ${doctorName}`,
      rawDate || new Date(),
      30,
      `Cita médica con Dr. ${doctorName}. Paciente: ${patientName}.`
    );

    const message = `✅ *Cita Confirmada*\n\n` +
      `Hola ${patientName}, tu cita ha sido agendada con éxito:\n\n` +
      `📅 *Fecha:* ${date}\n` +
      `⏰ *Hora:* ${time}\n` +
      `👨‍⚕️ *Doctor:* ${doctorName}\n` +
      `🏥 *Clínica SaaS*\n\n` +
      `📅 *Añadir a Google Calendar:*\n${calendarLink}\n\n` +
      `🔗 *Gestionar tu cita:*\nhttps://clinicasaas.app/citas/gestion/${appointmentId}\n\n` +
      `¡Te esperamos puntualmente!`;

    return await this.sendMessage({
      to,
      message,
      channel: 'WHATSAPP',
      messageType: 'APPOINTMENT_CONFIRMATION',
      organizationId,
      providerName,
      metadata: { appointmentId, patientName, doctorName },
      actorUserId
    });
  }

  /**
   * 2. Appointment 24h Reminder Notification
   */
  async sendAppointmentReminder({
    to,
    patientName,
    doctorName,
    specialtyName = 'Consulta General',
    date,
    time,
    appointmentId,
    rawDate = null,
    organizationId = null,
    providerName = null,
    actorUserId = null
  }) {
    const calendarLink = this._generateGoogleCalendarLink(
      `Cita Médica - Dr. ${doctorName}`,
      rawDate || new Date(),
      30,
      `Recordatorio de cita de ${specialtyName} con Dr. ${doctorName}.`
    );

    const message = `⏰ *Recordatorio de Cita Médica (Mañana)*\n\n` +
      `Hola ${patientName}, te recordamos que tienes una cita agendada para mañana:\n\n` +
      `📅 *Fecha:* ${date}\n` +
      `⏰ *Hora:* ${time}\n` +
      `👨‍⚕️ *Doctor:* ${doctorName} (${specialtyName})\n` +
      `🏥 *Clínica SaaS*\n\n` +
      `📅 *Añadir a Google Calendar:*\n${calendarLink}\n\n` +
      `🔗 *Confirmar o gestionar:*\nhttps://clinicasaas.app/appointments\n\n` +
      `¡Te esperamos puntualmente!`;

    return await this.sendMessage({
      to,
      message,
      channel: 'WHATSAPP',
      messageType: 'APPOINTMENT_REMINDER',
      organizationId,
      providerName,
      metadata: { appointmentId, patientName, doctorName },
      actorUserId
    });
  }

  /**
   * 3. Smart Waitlist Reassignment Offer
   */
  async sendWaitlistOffer({
    to,
    patientName,
    doctorName,
    date,
    time,
    entryId,
    offerToken,
    organizationId = null,
    providerName = null,
    actorUserId = null
  }) {
    const acceptUrl = `https://clinicasaas.app/waitlist/offer?token=${offerToken}&id=${entryId}`;
    const message = `✨ *Cupo Disponible en Lista de Espera*\n\n` +
      `Hola ${patientName}, se ha liberado un cupo prioritario para tu consulta médica:\n\n` +
      `👨‍⚕️ *Doctor:* ${doctorName}\n` +
      `📅 *Fecha:* ${date}\n` +
      `⏰ *Hora:* ${time}\n\n` +
      `⚡ *Tienes 15 minutos para aceptar este cupo antes de que pase al siguiente paciente:*\n` +
      `👉 ${acceptUrl}\n\n` +
      `Clínica SaaS`;

    return await this.sendMessage({
      to,
      message,
      channel: 'WHATSAPP',
      messageType: 'WAITLIST_OFFER',
      organizationId,
      providerName,
      metadata: { entryId, offerToken },
      actorUserId
    });
  }

  /**
   * 4. Cancellation Notice
   */
  async sendCancellationNotice({
    to,
    patientName,
    date,
    time,
    reason = 'A solicitud del paciente o fuerza mayor',
    organizationId = null,
    providerName = null,
    actorUserId = null
  }) {
    const message = `❌ *Cita Médica Cancelada*\n\n` +
      `Hola ${patientName}, tu cita programada para el ${date} a las ${time} ha sido cancelada.\n` +
      `Motivo: ${reason}.\n\n` +
      `Para reagendar cuando lo desees, visita: https://clinicasaas.app/appointments`;

    return await this.sendMessage({
      to,
      message,
      channel: 'WHATSAPP',
      messageType: 'CANCELLATION_NOTICE',
      organizationId,
      providerName,
      metadata: { reason },
      actorUserId
    });
  }

  /**
   * 5. Inbound Webhook Normalization & Delivery Receipt Processing
   */
  async handleProviderWebhook(providerName, payload, headers = {}) {
    const provider = this.factory.getProvider(providerName);
    const normalized = provider.parseWebhookPayload(payload, headers);

    if (!normalized || !normalized.providerMessageId) {
      return {
        processed: false,
        reason: 'Unrecognized or non-status webhook payload'
      };
    }

    const log = await CommunicationLog.findOne({
      where: { providerMessageId: normalized.providerMessageId }
    });

    if (!log) {
      logger.debug({
        providerMessageId: normalized.providerMessageId,
        msg: '[CommunicationsService] Webhook for message not in local logs'
      });
      return {
        processed: true,
        matched: false,
        normalized
      };
    }

    const previousStatus = log.status;
    log.status = normalized.status;
    if (normalized.status === 'FAILED' && normalized.raw?.error) {
      log.errorMessage = JSON.stringify(normalized.raw.error);
    }
    await log.save();

    // Domain Event
    const eventName = normalized.status === 'DELIVERED' || normalized.status === 'READ'
      ? DOMAIN_EVENTS.COMMUNICATION_DELIVERED
      : (normalized.status === 'FAILED' ? DOMAIN_EVENTS.COMMUNICATION_FAILED : null);

    if (eventName) {
      eventBus.publish(eventName, {
        logId: log.id,
        providerMessageId: normalized.providerMessageId,
        previousStatus,
        newStatus: normalized.status,
        recipient: log.recipient
      }, {
        organizationId: log.organizationId
      });
    }

    return {
      processed: true,
      matched: true,
      logId: log.id,
      previousStatus,
      newStatus: normalized.status
    };
  }

  /**
   * 6. Query Delivery Logs (Multi-Tenant Isolated)
   */
  async getCommunicationLogs({
    organizationId = null,
    status = null,
    channel = null,
    recipient = null,
    page = 1,
    limit = 20
  }) {
    const where = {};
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (recipient) where.recipient = recipient;

    const offset = (Math.max(1, page) - 1) * limit;

    const { count, rows } = await CommunicationLog.findAndCountAll({
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
      logs: rows
    };
  }

  /**
   * 7. Aggregated Delivery Analytics & Health
   */
  async getCommunicationStats({ organizationId = null }) {
    const where = {};
    if (organizationId) where.organizationId = organizationId;

    const logs = await CommunicationLog.findAll({
      where,
      attributes: ['provider', 'channel', 'status', 'messageType']
    });

    const total = logs.length;
    let delivered = 0;
    let read = 0;
    let failed = 0;
    let sent = 0;

    const providerCounts = {};
    const typeCounts = {};

    for (const item of logs) {
      if (item.status === 'DELIVERED') delivered++;
      else if (item.status === 'READ') { delivered++; read++; }
      else if (item.status === 'FAILED') failed++;
      else sent++;

      providerCounts[item.provider] = (providerCounts[item.provider] || 0) + 1;
      typeCounts[item.messageType] = (typeCounts[item.messageType] || 0) + 1;
    }

    const deliveryRate = total > 0 ? Number(((delivered / total) * 100).toFixed(2)) : 100.0;

    return {
      totalMessages: total,
      sent,
      delivered,
      read,
      failed,
      deliveryRatePercentage: deliveryRate,
      breakdownByProvider: providerCounts,
      breakdownByMessageType: typeCounts,
      availableProviders: this.factory.getAvailableProviders()
    };
  }
}

module.exports = new CommunicationsService();
