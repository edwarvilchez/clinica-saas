'use strict';

const BaseWhatsAppProvider = require('./BaseWhatsAppProvider');
const axios = require('axios');
const logger = require('../../../utils/logger');

/**
 * 📲 TwilioWhatsAppProvider
 * Production adapter for Twilio WhatsApp Messaging API
 */
class TwilioWhatsAppProvider extends BaseWhatsAppProvider {
  constructor(config = {}) {
    super('TWILIO', config);
    this.accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = config.fromNumber || process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';
  }

  isConfigured() {
    return Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  _formatNumber(number) {
    if (!number) return '';
    const clean = String(number).trim().replace(/[\s-]/g, '');
    return clean.startsWith('whatsapp:') ? clean : `whatsapp:${clean}`;
  }

  async sendTextMessage({ to, body, metadata = {} }) {
    if (!this.isConfigured()) {
      logger.warn('[TwilioWhatsAppProvider] Missing Twilio credentials. Falling back to mock dispatch.');
      return {
        success: false,
        provider: 'TWILIO',
        error: 'Twilio provider credentials are not configured.'
      };
    }

    try {
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', this._formatNumber(this.fromNumber));
      params.append('To', this._formatNumber(to));
      params.append('Body', body);

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        params,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      return {
        success: true,
        messageId: response.data.sid,
        provider: 'TWILIO',
        status: 'SENT',
        recipient: to,
        rawResponse: response.data
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      logger.error({ error: errorMsg, to, msg: '❌ [Twilio] Message delivery failed' });
      return {
        success: false,
        provider: 'TWILIO',
        error: errorMsg
      };
    }
  }

  async sendTemplateMessage({ to, templateName, language = 'es', components = [], metadata = {} }) {
    // Twilio Content API or standard message with template fallback
    const body = `Template [${templateName}]: ${JSON.stringify(components)}`;
    return await this.sendTextMessage({ to, body, metadata });
  }

  parseWebhookPayload(payload, headers = {}) {
    // Twilio sends application/x-www-form-urlencoded or JSON
    // MessageSid, MessageStatus ('queued', 'sent', 'delivered', 'read', 'failed', 'undelivered')
    const sid = payload.MessageSid || payload.SmsSid;
    if (!sid) return null;

    const rawStatus = String(payload.MessageStatus || payload.SmsStatus || '').toLowerCase();
    let status = 'SENT';

    if (rawStatus === 'delivered') status = 'DELIVERED';
    else if (rawStatus === 'read') status = 'READ';
    else if (rawStatus === 'failed' || rawStatus === 'undelivered') status = 'FAILED';
    else if (rawStatus === 'queued' || rawStatus === 'sending') status = 'QUEUED';

    return {
      provider: 'TWILIO',
      providerMessageId: sid,
      status,
      recipient: payload.To ? payload.To.replace('whatsapp:', '') : null,
      timestamp: new Date().toISOString(),
      raw: payload
    };
  }
}

module.exports = TwilioWhatsAppProvider;
