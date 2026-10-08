'use strict';

const SimulationWhatsAppProvider = require('./SimulationWhatsAppProvider');
const TwilioWhatsAppProvider = require('./TwilioWhatsAppProvider');
const MetaCloudWhatsAppProvider = require('./MetaCloudWhatsAppProvider');
const UltraMsgWhatsAppProvider = require('./UltraMsgWhatsAppProvider');
const logger = require('../../../utils/logger');

/**
 * 🏭 WhatsAppProviderFactory
 * Centralized Provider Registry and Factory
 * Decouples clinical business logic from specific delivery gateways.
 */
class WhatsAppProviderFactory {
  constructor() {
    this._providers = new Map();
    this._defaultProviderName = (process.env.WHATSAPP_PROVIDER || 'SIMULATION').toUpperCase();
    this._initializeDefaultProviders();
  }

  _initializeDefaultProviders() {
    this.registerProvider('SIMULATION', new SimulationWhatsAppProvider());
    this.registerProvider('TWILIO', new TwilioWhatsAppProvider());
    this.registerProvider('META_CLOUD', new MetaCloudWhatsAppProvider());
    this.registerProvider('ULTRAMSG', new UltraMsgWhatsAppProvider());
  }

  /**
   * Register a custom or tenant-specific provider instance
   */
  registerProvider(name, providerInstance) {
    if (!name || !providerInstance) {
      throw new Error('[WhatsAppProviderFactory] Provider name and instance are required.');
    }
    this._providers.set(name.toUpperCase(), providerInstance);
    logger.debug(`[WhatsAppProviderFactory] Registered provider: ${name.toUpperCase()}`);
  }

  /**
   * Retrieve active provider by name or fallback to default
   */
  getProvider(providerName = null) {
    const target = (providerName || this._defaultProviderName).toUpperCase();
    const provider = this._providers.get(target);

    if (!provider) {
      logger.warn(`[WhatsAppProviderFactory] Provider '${target}' not found. Falling back to SIMULATION.`);
      return this._providers.get('SIMULATION');
    }

    return provider;
  }

  /**
   * List all available provider names
   */
  getAvailableProviders() {
    return Array.from(this._providers.keys());
  }

  /**
   * Set global default provider
   */
  setDefaultProvider(name) {
    if (!name) return;
    this._defaultProviderName = name.toUpperCase();
  }
}

// Global Singleton Factory
const factoryInstance = new WhatsAppProviderFactory();

module.exports = {
  WhatsAppProviderFactory,
  providerFactory: factoryInstance
};
