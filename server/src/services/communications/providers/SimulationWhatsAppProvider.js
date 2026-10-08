'use strict';

const BaseWhatsAppProvider = require('./BaseWhatsAppProvider');
const logger = require('../../../utils/logger');

/**
 * 🧪 SimulationWhatsAppProvider
 * Mock provider for local development, sandbox testing and unit test suites.
 * Stores in-memory delivery buffer.
 */
class SimulationWhatsAppProvider extends BaseWhatsAppProvider {
  constructor(config = {}) {
    super('SIMULATION', config);
    this._sentHistory = [];
  }

  isConfigured() {
    return true;
  }

  async sendTextMessage({ to, body, metadata = {} }) {
    const messageId = `sim-msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const record = {
      messageId,
      provider: 'SIMULATION',
      to,
      body,
      status: 'SENT',
      metadata,
      sentAt: new Date().toISOString()
    };

    this._sentHistory.push(record);

    logger.debug({
      provider: 'SIMULATION',
      to,
      messageId,
      msg: '📱 [WhatsApp Simulation] Message dispatched successfully.'
    });

    return {
      success: true,
      messageId,
      provider: 'SIMULATION',
      status: 'SENT',
      recipient: to
    };
  }

  async sendTemplateMessage({ to, templateName, language = 'es', components = [], metadata = {} }) {
    const body = `[Template: ${templateName} (${language})] Content variables: ${JSON.stringify(components)}`;
    return await this.sendTextMessage({ to, body, metadata });
  }

  parseWebhookPayload(payload, headers = {}) {
    if (!payload || !payload.messageId) return null;

    let normalizedStatus = 'SENT';
    const rawStatus = String(payload.status || '').toLowerCase();

    if (rawStatus === 'delivered') normalizedStatus = 'DELIVERED';
    else if (rawStatus === 'read') normalizedStatus = 'READ';
    else if (rawStatus === 'failed') normalizedStatus = 'FAILED';

    return {
      provider: 'SIMULATION',
      providerMessageId: payload.messageId,
      status: normalizedStatus,
      recipient: payload.to || null,
      timestamp: payload.timestamp || new Date().toISOString(),
      raw: payload
    };
  }

  getSentMessages() {
    return [...this._sentHistory];
  }

  clearHistory() {
    this._sentHistory = [];
  }
}

module.exports = SimulationWhatsAppProvider;
