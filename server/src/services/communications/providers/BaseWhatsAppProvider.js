'use strict';

/**
 * 🔌 BaseWhatsAppProvider - Abstract Contract for WhatsApp Delivery Providers
 * Enforces provider decoupling (Twilio, Meta Cloud API, UltraMsg, Simulation)
 */
class BaseWhatsAppProvider {
  constructor(name, config = {}) {
    if (new.target === BaseWhatsAppProvider) {
      throw new TypeError('Cannot construct BaseWhatsAppProvider instances directly.');
    }
    this.name = name;
    this.config = config;
  }

  getName() {
    return this.name;
  }

  isConfigured() {
    return true;
  }

  /**
   * Send arbitrary text message
   * @param {Object} params - { to, body, metadata }
   * @returns {Promise<Object>} { success, messageId, provider, status, error }
   */
  async sendTextMessage({ to, body, metadata = {} }) {
    throw new Error('Method sendTextMessage() must be implemented by subclass.');
  }

  /**
   * Send structured template message
   * @param {Object} params - { to, templateName, language, components, metadata }
   * @returns {Promise<Object>} { success, messageId, provider, status, error }
   */
  async sendTemplateMessage({ to, templateName, language = 'es', components = [], metadata = {} }) {
    throw new Error('Method sendTemplateMessage() must be implemented by subclass.');
  }

  /**
   * Parse incoming webhook payload to normalized delivery status
   * @param {Object} payload
   * @param {Object} headers
   * @returns {Object|null} { providerMessageId, status: 'SENT'|'DELIVERED'|'READ'|'FAILED', recipient, timestamp, raw }
   */
  parseWebhookPayload(payload, headers = {}) {
    throw new Error('Method parseWebhookPayload() must be implemented by subclass.');
  }
}

module.exports = BaseWhatsAppProvider;
