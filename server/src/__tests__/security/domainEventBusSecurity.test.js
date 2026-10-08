'use strict';

const { DomainEventBus, eventBus, DOMAINS, DOMAIN_EVENTS } = require('../../events/eventBus');

describe('🛡️ FASE 16: Modular Monolith Domain Boundaries & Internal DomainEventBus', () => {
  let customBus;

  beforeEach(() => {
    customBus = new DomainEventBus();
    eventBus.clearHistory();
  });

  describe('1. Canonical Domain Boundaries & Event Definitions', () => {
    it('🔒 Verifies complete dictionary of architectural domain aggregates', () => {
      expect(DOMAINS.IDENTITY).toBe('identity');
      expect(DOMAINS.ORGANIZATIONS).toBe('organizations');
      expect(DOMAINS.PATIENTS).toBe('patients');
      expect(DOMAINS.APPOINTMENTS).toBe('appointments');
      expect(DOMAINS.CLINICAL).toBe('clinical');
      expect(DOMAINS.BILLING).toBe('billing');
      expect(DOMAINS.INVENTORY).toBe('inventory');
      expect(DOMAINS.HOSPITAL).toBe('hospital');
      expect(DOMAINS.NOTIFICATIONS).toBe('notifications');
      expect(DOMAINS.FILES).toBe('files');
      expect(DOMAINS.AUDIT).toBe('audit');

      // Dictionary must be deeply frozen
      expect(Object.isFrozen(DOMAINS)).toBe(true);
    });

    it('🔒 Verifies core canonical domain event signatures', () => {
      expect(DOMAIN_EVENTS.PATIENT_REGISTERED).toBe('Patient.Registered');
      expect(DOMAIN_EVENTS.APPOINTMENT_SCHEDULED).toBe('Appointment.Scheduled');
      expect(DOMAIN_EVENTS.APPOINTMENT_CANCELLED).toBe('Appointment.Cancelled');
      expect(DOMAIN_EVENTS.PAYMENT_COLLECTED).toBe('Billing.PaymentCollected');
      expect(DOMAIN_EVENTS.MEDICAL_RECORD_SIGNED).toBe('Clinical.MedicalRecordSigned');
      expect(DOMAIN_EVENTS.SECURITY_ANOMALY_DETECTED).toBe('Identity.SecurityAnomalyDetected');

      expect(Object.isFrozen(DOMAIN_EVENTS)).toBe(true);
    });
  });

  describe('2. Asynchronous Event Bus Mechanics & Subscription Delivery', () => {
    it('🔒 Dispatches event asynchronously with immutable envelope and correlationId', async () => {
      const receivedEvents = [];

      customBus.subscribe(DOMAIN_EVENTS.APPOINTMENT_SCHEDULED, (envelope) => {
        receivedEvents.push(envelope);
      });

      const publishedEnvelope = customBus.publish(DOMAIN_EVENTS.APPOINTMENT_SCHEDULED, {
        appointmentId: 'apt-12345',
        patientId: 'pat-99999',
        doctorId: 'doc-88888',
        date: '2026-10-15T10:00:00Z'
      }, {
        organizationId: 'org-tenant-1',
        userId: 'usr-admin-1',
        correlationId: 'corr-xyz-100'
      });

      expect(publishedEnvelope).toBeDefined();
      expect(publishedEnvelope.id).toBeDefined();
      expect(publishedEnvelope.eventName).toBe(DOMAIN_EVENTS.APPOINTMENT_SCHEDULED);
      expect(publishedEnvelope.metadata.correlationId).toBe('corr-xyz-100');
      expect(publishedEnvelope.payload.appointmentId).toBe('apt-12345');

      // Envelope must be immutable
      expect(Object.isFrozen(publishedEnvelope)).toBe(true);
      expect(Object.isFrozen(publishedEnvelope.payload)).toBe(true);
      expect(Object.isFrozen(publishedEnvelope.metadata)).toBe(true);

      // Wait for async dispatch
      await new Promise(resolve => setImmediate(resolve));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe(publishedEnvelope.id);
      expect(receivedEvents[0].payload.patientId).toBe('pat-99999');
    });

    it('🔒 Supports wildcard subscriber for global analytics and audit listeners', async () => {
      const wildcardTraces = [];

      customBus.subscribe('*', (envelope) => {
        wildcardTraces.push(envelope);
      });

      customBus.publish(DOMAIN_EVENTS.PAYMENT_COLLECTED, { amount: 150.00 });
      customBus.publish(DOMAIN_EVENTS.MEDICAL_RECORD_SIGNED, { medicalRecordId: 'med-777' });

      await new Promise(resolve => setImmediate(resolve));

      expect(wildcardTraces.length).toBe(2);
      expect(wildcardTraces[0].eventName).toBe(DOMAIN_EVENTS.PAYMENT_COLLECTED);
      expect(wildcardTraces[1].eventName).toBe(DOMAIN_EVENTS.MEDICAL_RECORD_SIGNED);
    });

    it('🔒 Unsubscribes handler cleanly via returned disposer function', async () => {
      let callCount = 0;
      const unsubscribe = customBus.subscribe(DOMAIN_EVENTS.USER_LOGGED_IN, () => {
        callCount++;
      });

      customBus.publish(DOMAIN_EVENTS.USER_LOGGED_IN, { userId: 'usr-1' });
      await new Promise(resolve => setImmediate(resolve));
      expect(callCount).toBe(1);

      // Unsubscribe
      unsubscribe();

      customBus.publish(DOMAIN_EVENTS.USER_LOGGED_IN, { userId: 'usr-2' });
      await new Promise(resolve => setImmediate(resolve));
      expect(callCount).toBe(1); // Should not increase
    });

    it('🔒 Fault Isolation: An exception in one subscriber does NOT crash the event bus or block other subscribers', async () => {
      const safeResults = [];

      // Subscriber 1: Throws uncaught exception
      customBus.subscribe(DOMAIN_EVENTS.PATIENT_REGISTERED, () => {
        throw new Error('Simulated crash in third-party marketing integration');
      });

      // Subscriber 2: Healthy subscriber
      customBus.subscribe(DOMAIN_EVENTS.PATIENT_REGISTERED, (envelope) => {
        safeResults.push(envelope.payload.patientId);
      });

      // Publish event
      expect(() => {
        customBus.publish(DOMAIN_EVENTS.PATIENT_REGISTERED, { patientId: 'pat-alive' });
      }).not.toThrow();

      await new Promise(resolve => setImmediate(resolve));

      // Healthy subscriber must receive the event despite the first subscriber failure
      expect(safeResults).toContain('pat-alive');
    });
  });

  describe('3. In-Memory Event History & Diagnostics', () => {
    it('🔒 Records recent events up to maximum buffer and drops older entries', () => {
      for (let i = 0; i < 110; i++) {
        customBus.publish(DOMAIN_EVENTS.USER_LOGGED_IN, { sequence: i });
      }

      const history = customBus.getRecentEvents();
      expect(history.length).toBe(100); // Max buffer size
      expect(history[history.length - 1].payload.sequence).toBe(109);
    });
  });
});
