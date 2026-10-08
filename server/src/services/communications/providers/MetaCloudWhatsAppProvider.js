'use strict';

const BaseWhatsAppProvider = require('./BaseWhatsAppProvider');
const axios = require('axios');
const logger = require('../../../utils/logger');

/**
 * 🌐 MetaCloudWhatsAppProvider
 * Official Meta WhatsApp Business Cloud API (Graph API)
 */
class MetaCloudWhatsAppProvider extends BaseWhatsAppProvider {
  constructor(config = {}) {
    super('META_CLOUD', config);
    this.accessToken = config.accessToken || process.env.META_WHATSAPP_TOKEN;
    this.phoneNumberId = config.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    this.apiVersion = config.apiVersion || 'v20.0';
  }

  isConfigured() {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  _cleanRecipient(phone) {
    if (!phone) return '';
    return String(phone).replace(/[^0-9]/g, '');
  }

  async sendTextMessage({ to, body, metadata = {} }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'META_CLOUD',
        error: 'Meta Cloud API credentials are not configured.'
      };
    }

    try {
      const recipient = this._cleanRecipient(to);
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: {
            preview_url: false,
            body
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const msgId = response.data?.messages?.[0]?.id || `meta-${Date.now()}`;

      return {
        success: true,
        messageId: msgId,
        provider: 'META_CLOUD',
        status: 'SENT',
        recipient,
        rawResponse: response.data
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error({ error: errorMsg, to, msg: '❌ [Meta Cloud API] Message delivery failed' });
      return {
        success: false,
        provider: 'META_CLOUD',
        error: errorMsg
      };
    }
  }

  async sendTemplateMessage({ to, templateName, language = 'es', components = [], metadata = {} }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'META_CLOUD',
        error: 'Meta Cloud API credentials are not configured.'
      };
    }

    try {
      const recipient = this._cleanRecipient(to);
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const msgId = response.data?.messages?.[0]?.id || `meta-tpl-${Date.now()}`;

      return {
        success: true,
        messageId: msgId,
        provider: 'META_CLOUD',
        status: 'SENT',
        recipient,
        rawResponse: response.data
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      return {
        success: false,
        provider: 'META_CLOUD',
        error: errorMsg
      };
    }
  }

  parseWebhookPayload(payload, headers = {}) {
    // Meta Cloud Webhook structure: entry[0].changes[0].value.statuses[0]
    const statusObj = payload?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
    if (!statusObj) return null;

    const rawStatus = String(statusObj.status || '').toLowerCase();
    let status = 'SENT';

    if (rawStatus === 'delivered') status = 'DELIVERED';
    else if (rawStatus === 'read') status = 'READ';
    else if (rawStatus === 'failed') status = 'FAILED';

    return {
      provider: 'META_CLOUD',
      providerMessageId: statusObj.id,
      status,
      recipient: statusObj.recipient_id || null,
      timestamp: statusObj.timestamp ? new Date(parseInt(statusObj.timestamp) * 1000).toISOString() : new Date().toISOString(),
      raw: statusObj
    };
  }
}

module.exports = MetaCloudWhatsAppProvider;
