'use strict';

/**
 * 🏛️ DOMAIN BOUNDARIES SPECIFICATION - Modular Monolith Architecture
 * Defines canonical domain aggregates, bounded contexts, and allowed dependencies.
 */
const DOMAINS = Object.freeze({
  IDENTITY: 'identity',           // Users, Authentication, Roles, TOTP 2FA, Refresh Tokens
  ORGANIZATIONS: 'organizations', // Tenants, Clinics, Subscriptions, Quota Limits
  PATIENTS: 'patients',           // Demographics, Medical Records, Insurance Coverage
  APPOINTMENTS: 'appointments',   // Scheduling, Agenda, Status Workflow, Video Consultations
  CLINICAL: 'clinical',           // Consultations, Medical Records, Prescriptions, Lab Results
  BILLING: 'billing',             // Invoicing, Payments, Doctor Fees, Revenue Splits, CXP
  INVENTORY: 'inventory',         // Pharmacy Stock, Batches, FEFO, Supplies
  HOSPITAL: 'hospital',           // Admissions, Bed Stays, Area Movements, Discharges
  NOTIFICATIONS: 'notifications', // WhatsApp, Email, Push Alerts, Background Queue
  FILES: 'files',                 // Encrypted Medical Documents, Receipts, Lab PDFs
  AUDIT: 'audit'                  // Cryptographic SHA-256 Tamper-Evident Trail
});

/**
 * 📢 CANONICAL DOMAIN EVENTS
 * Immutable event signatures emitted when state changes across domain boundaries.
 */
const DOMAIN_EVENTS = Object.freeze({
  // Identity & Security
  USER_LOGGED_IN: 'Identity.UserLoggedIn',
  USER_PASSWORD_RESET: 'Identity.UserPasswordReset',
  SECURITY_ANOMALY_DETECTED: 'Identity.SecurityAnomalyDetected',

  // Patient & Clinical
  PATIENT_REGISTERED: 'Patient.Registered',
  PATIENT_UPDATED: 'Patient.Updated',
  MEDICAL_RECORD_CREATED: 'Clinical.MedicalRecordCreated',
  MEDICAL_RECORD_SIGNED: 'Clinical.MedicalRecordSigned',
  PRESCRIPTION_ISSUED: 'Clinical.PrescriptionIssued',
  LAB_RESULT_UPLOADED: 'Clinical.LabResultUploaded',

  // Appointments
  APPOINTMENT_SCHEDULED: 'Appointment.Scheduled',
  APPOINTMENT_CONFIRMED: 'Appointment.Confirmed',
  APPOINTMENT_CANCELLED: 'Appointment.Cancelled',
  APPOINTMENT_COMPLETED: 'Appointment.Completed',
  APPOINTMENT_NO_SHOW: 'Appointment.NoShow',
  APPOINTMENT_REMINDER_SENT: 'Appointment.ReminderSent',

  // Smart Waitlist
  WAITLIST_ENTRY_CREATED: 'Waitlist.EntryCreated',
  WAITLIST_OFFER_SENT: 'Waitlist.OfferSent',
  WAITLIST_OFFER_ACCEPTED: 'Waitlist.OfferAccepted',
  WAITLIST_OFFER_DECLINED: 'Waitlist.OfferDeclined',

  // Billing & Financial
  PAYMENT_RECEIVED: 'Billing.PaymentReceived',
  PAYMENT_COLLECTED: 'Billing.PaymentCollected',
  DOCTOR_FEE_RECONCILED: 'Billing.DoctorFeeReconciled',
  SUBSCRIPTION_UPGRADED: 'Billing.SubscriptionUpgraded',
  REVENUE_ANALYTICS_REQUESTED: 'Billing.RevenueAnalyticsRequested',
  REVENUE_REPORT_EXPORTED: 'Billing.RevenueReportExported',

  // Hospitalization
  ADMISSION_OPENED: 'Hospital.AdmissionOpened',
  ADMISSION_DISCHARGED: 'Hospital.AdmissionDischarged',
  PATIENT_AREA_TRANSFERRED: 'Hospital.PatientAreaTransferred',

  // Patient Portal (Fase 23)
  PORTAL_PROFILE_UPDATED: 'Portal.ProfileUpdated',
  PORTAL_APPOINTMENT_BOOKED: 'Portal.AppointmentBooked',
  PORTAL_APPOINTMENT_CANCELLED: 'Portal.AppointmentCancelled',

  // Clinical AI Decision Support (Fase 24)
  AI_CLINICAL_BRIEF_GENERATED: 'AI.ClinicalBriefGenerated',
  AI_CLINICAL_SUGGESTION_GENERATED: 'AI.ClinicalSuggestionGenerated',
  AI_CLINICAL_DRAFT_APPROVED: 'AI.ClinicalDraftApproved',
  AI_CLINICAL_DRAFT_REJECTED: 'AI.ClinicalDraftRejected'
});

module.exports = {
  DOMAINS,
  DOMAIN_EVENTS
};
