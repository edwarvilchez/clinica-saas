'use strict';

/**
 * 🛡️ FASE 27: Future Microservices Architectural Integrity & Contract Validation Suite
 * Verifies that FUTURE_MICROSERVICES.md exists, conforms to modular boundaries,
 * analyzes the 6 required services with extraction triggers, and adheres to domain events.
 */

const fs = require('fs');
const path = require('path');
const { DOMAINS, DOMAIN_EVENTS } = require('../../events/domainEvents');

describe('🏛️ FASE 27: Future Microservices Architectural Specification Validation', () => {
  const docPath = path.resolve(__dirname, '../../../../FUTURE_MICROSERVICES.md');
  let docContent;

  beforeAll(() => {
    expect(fs.existsSync(docPath)).toBe(true);
    docContent = fs.readFileSync(docPath, 'utf8');
  });

  describe('1. Document Structure & Core Sections', () => {
    it('debe existir el documento FUTURE_MICROSERVICES.md en la raíz del repositorio', () => {
      expect(fs.existsSync(docPath)).toBe(true);
      expect(docContent.length).toBeGreaterThan(2000);
    });

    it('debe documentar los principios de desacoplamiento y el patrón Strangler Fig', () => {
      expect(docContent).toMatch(/Strangler Fig/i);
      expect(docContent).toMatch(/Monolito Modular/i);
      expect(docContent).toMatch(/Row-Level Security/i);
    });

    it('debe incluir diagramas de arquitectura en sintaxis Mermaid', () => {
      expect(docContent).toMatch(/```mermaid/);
      expect(docContent).toMatch(/flowchart TD|sequenceDiagram/);
    });
  });

  describe('2. Análisis Exhaustivo de los 6 Microservicios Candidatos', () => {
    const requiredServices = [
      { name: 'Notifications', tag: 'svc-notifications' },
      { name: 'Clinical AI / CDSS', tag: 'svc-clinical-ai' },
      { name: 'File Storage', tag: 'svc-file-storage' },
      { name: 'Telemedicine', tag: 'svc-telemedicine' },
      { name: 'Audit & Compliance', tag: 'svc-audit-compliance' },
      { name: 'Analytics & Billing', tag: 'svc-analytics-billing' }
    ];

    test.each(requiredServices)('debe detallar el candidato %s ($tag)', ({ tag }) => {
      expect(docContent).toContain(tag);
    });

    it('debe especificar disparadores operacionales cuantitativos para cada candidato', () => {
      expect(docContent).toMatch(/Disparadores Operacionales de Extracción/i);
      expect(docContent).toMatch(/100,000 notificaciones\/día/i);
      expect(docContent).toMatch(/inferencia en modelos/i);
      expect(docContent).toMatch(/consultas simultáneas/i);
      expect(docContent).toMatch(/15:1/);
      expect(docContent).toMatch(/OLAP vs OLTP/i);
    });

    it('debe especificar contratos de datos para APIs síncronas (REST/gRPC) y asíncronas', () => {
      expect(docContent).toMatch(/syntax = "proto3";/);
      expect(docContent).toMatch(/service ClinicalAiService/);
      expect(docContent).toMatch(/\/api\/v1\/notifications\/send/);
      expect(docContent).toMatch(/\/api\/v1\/files\/upload-url/);
      expect(docContent).toMatch(/\/api\/v1\/telemed\/rooms/);
    });
  });

  describe('3. Alineación con Canonical Domain Events y Dominio DDD', () => {
    it('debe referenciar los eventos de dominio canónicos implementados en domainEvents.js', () => {
      const canonicalEventsToCheck = [
        DOMAIN_EVENTS.APPOINTMENT_SCHEDULED,
        DOMAIN_EVENTS.COMMUNICATION_SENT,
        DOMAIN_EVENTS.COMMUNICATION_DELIVERED,
        DOMAIN_EVENTS.CLINICAL_PRESCRIPTION_ISSUED || 'Clinical.PrescriptionIssued',
        DOMAIN_EVENTS.TELEMEDICINE_SESSION_CREATED,
        DOMAIN_EVENTS.TELEMEDICINE_SESSION_ENDED,
        DOMAIN_EVENTS.AI_CLINICAL_DRAFT_APPROVED || 'AI.ClinicalDraftApproved',
        DOMAIN_EVENTS.BILLING_PAYMENT_RECEIVED || 'Billing.PaymentReceived'
      ];

      canonicalEventsToCheck.forEach((evt) => {
        expect(docContent).toContain(evt);
      });
    });
  });

  describe('4. Seguridad Inter-Servicios (Zero Trust) y Resiliencia', () => {
    it('debe documentar mTLS, Service JWTs y encabezados obligatorios de contexto', () => {
      expect(docContent).toMatch(/mTLS/i);
      expect(docContent).toMatch(/Service-to-Service JWT/i);
      expect(docContent).toMatch(/X-Tenant-ID/);
      expect(docContent).toMatch(/X-Correlation-ID/);
      expect(docContent).toMatch(/X-User-ID/);
      expect(docContent).toMatch(/X-User-Role/);
    });

    it('debe especificar estrategias de tolerancia a fallos, circuit breakers y degeneración agraciada', () => {
      expect(docContent).toMatch(/Circuit Breaker/i);
      expect(docContent).toMatch(/Dead Letter Queue/i);
      expect(docContent).toMatch(/Degeneración Agraciada|Graceful Degradation/i);
    });

    it('debe incluir matriz de priorización con niveles P1, P2 y P3', () => {
      expect(docContent).toMatch(/P1 \(Inmediata/);
      expect(docContent).toMatch(/P2 \(Media\)/);
      expect(docContent).toMatch(/P3 \(Futura\)/);
    });
  });
});
