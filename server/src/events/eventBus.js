'use strict';

const EventEmitter = require('events');
const { DOMAIN_EVENTS, DOMAINS } = require('./domainEvents');
const logger = require('../utils/logger');

/**
 * 🚌 DomainEventBus - In-Memory Asynchronous Modular Event Bus
 * Decouples domain logic across modules and prepares the architecture for external brokers
 * (Redis Pub/Sub, RabbitMQ or AWS EventBridge) when migrating to microservices.
 */
class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow up to 100 concurrent domain subscribers per event without warning
    this.setMaxListeners(100);
    this._eventHistory = [];
    this._maxHistory = 100;
  }

  /**
   * Publishes an immutable domain event to all registered subscribers.
   * Dispatches asynchronously via process.nextTick / setImmediate to prevent blocking main transaction thread.
   *
   * @param {string} eventName - Canonical event name from DOMAIN_EVENTS
   * @param {object} payload - Immutable event payload
   * @param {object} metadata - Context metadata (organizationId, userId, correlationId)
   */
  publish(eventName, payload = {}, metadata = {}) {
    if (!eventName || typeof eventName !== 'string') {
      throw new Error('[DomainEventBus] Invalid eventName provided for publish.');
    }

    const eventEnvelope = Object.freeze({
      id: require('crypto').randomUUID(),
      eventName,
      occurredAt: new Date().toISOString(),
      metadata: Object.freeze({
        organizationId: metadata.organizationId || null,
        userId: metadata.userId || null,
        requestId: metadata.requestId || null,
        correlationId: metadata.correlationId || require('crypto').randomUUID()
      }),
      payload: Object.freeze({ ...payload })
    });

    // Record in bounded in-memory audit history for diagnostics
    if (this._eventHistory.length >= this._maxHistory) {
      this._eventHistory.shift();
    }
    this._eventHistory.push(eventEnvelope);

    logger.debug({
      event: eventName,
      eventId: eventEnvelope.id,
      correlationId: eventEnvelope.metadata.correlationId,
      msg: `[DomainEventBus] Emitting event: ${eventName}`
    });

    // Asynchronous non-blocking dispatch
    setImmediate(() => {
      try {
        this.emit(eventName, eventEnvelope);
        this.emit('*', eventEnvelope); // Wildcard subscriber for global analytics or audit
      } catch (dispatchError) {
        logger.error({
          error: dispatchError.message,
          stack: dispatchError.stack,
          eventName,
          msg: `[DomainEventBus] Unhandled error in subscriber for event ${eventName}`
        });
      }
    });

    return eventEnvelope;
  }

  /**
   * Subscribes a handler to a specific domain event with isolated error safety.
   *
   * @param {string} eventName - Canonical event name or '*'
   * @param {function} handler - Asynchronous or synchronous subscriber function
   */
  subscribe(eventName, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`[DomainEventBus] Handler for event ${eventName} must be a function.`);
    }

    const safeHandler = async (eventEnvelope) => {
      try {
        await handler(eventEnvelope);
      } catch (err) {
        logger.error({
          error: err.message,
          eventName,
          eventId: eventEnvelope?.id,
          msg: `[DomainEventBus] Subscriber failed while processing event: ${eventName}`
        });
      }
    };

    this.on(eventName, safeHandler);

    // Return un-subscribe disposer
    return () => this.off(eventName, safeHandler);
  }

  /**
   * Get recently published events in memory
   */
  getRecentEvents() {
    return [...this._eventHistory];
  }

  /**
   * Reset in-memory history (useful in test suites)
   */
  clearHistory() {
    this._eventHistory = [];
  }
}

// Global Singleton Instance
const eventBusInstance = new DomainEventBus();

module.exports = {
  DomainEventBus,
  eventBus: eventBusInstance,
  DOMAIN_EVENTS,
  DOMAINS
};
