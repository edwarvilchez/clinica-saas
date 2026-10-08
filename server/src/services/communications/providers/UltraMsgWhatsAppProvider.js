'use strict';

const BaseWhatsAppProvider = require('./BaseWhatsAppProvider');
const axios = require('axios');
const logger = require('../../../utils/logger');

/**
 * ⚡ UltraMsgWhatsAppProvider
 * REST API gateway adapter for UltraMsg / Evolution API WhatsApp instances
 */
class UltraMsgWhatsAppProvider extends BaseWhatsAppProvider {
  constructor(config = {}) {
    super('ULTRAMSG', config);
    this.instanceId = config.instanceId || process.env.ULTRAMSG_INSTANCE_ID;
    this.token = config.token || process.env.ULTRAMSG_TOKEN;
    this.baseUrl = config.baseUrl || 'https://api.ultramsg.com';
  }

  isConfigured() {
    return Boolean(this.instanceId && this.token);
  }

  _cleanRecipient(phone) {
    if (!phone) return '';
    return String(phone).replace(/[^0-9]/g, '');
  }

  async sendTextMessage({ to, body, metadata = {} }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'ULTRAMSG',
        error: 'UltraMsg credentials are not configured.'
      };
    }

    try {
      const recipient = this._cleanRecipient(to);
      const url = `${this.baseUrl}/${this.instanceId}/messages/chat`;

      const response = await axios.post(
        url,
        {
          token: this.token,
          to: recipient,
          body
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      const msgId = String(response.data?.id || `um-${Date.now()}`);

      return {
        success: true,
        messageId: msgId,
        provider: 'ULTRAMSG',
        status: 'SENT',
        recipient,
        rawResponse: response.data
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      logger.error({ error: errorMsg, to, msg: '❌ [UltraMsg] Message delivery failed' });
      return {
        success: false,
        provider: 'ULTRAMSG',
        error: errorMsg
      };
    }
  }

  async sendTemplateMessage({ to, templateName, language = 'es', components = [], metadata = {} }) {
    return await this.sendTextMessage({ to, body: `[Template: ${templateName}] Variables: ${JSON.stringify(components)}`, metadata });
  }

  parseWebhookPayload(payload, headers = {}) {
    // UltraMsg webhook format: { event_type: "message_ack", data: { id: "...", ack: "delivered"|"read"|"failed" } }
    const data = payload?.data || payload;
    if (!data?.id) return null;

    const rawAck = String(data.ack || data.status || '').toLowerCase();
    let status = 'SENT';

    if (rawAck === 'delivered') status = 'DELIVERED';
    else if (rawAck === 'read') status = 'READ';
    else if (rawAck === 'failed' || rawAck === 'error') status = 'FAILED';

    return {
      provider: 'ULTRAMSG',
      providerMessageId: String(data.id),
      status,
      recipient: data.to || null,
      timestamp: new Date().toISOString(),
      raw: payload
    };
  }
}

module.exports = UltraMsgWhatsAppProvider;
