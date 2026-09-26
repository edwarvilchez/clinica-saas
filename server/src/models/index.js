const User = require('./User');
const Role = require('./Role');
const Department = require('./Department');
const Specialty = require('./Specialty');
const Doctor = require('./Doctor');
const Patient = require('./Patient');
const Nurse = require('./Nurse');
const Staff = require('./Staff');
const Appointment = require('./Appointment');
const MedicalRecord = require('./MedicalRecord');
const LabResult = require('./LabResult');
const Payment = require('./Payment');
const sequelize = require('../config/db.config');
const VideoConsultation = require('./VideoConsultation');
const Organization = require('./Organization');
const AuditLog = require('./auditLog');
const Drug = require('./Drug');
const Prescription = require('./Prescription');
const LabTest = require('./LabTest');
const LabCombo = require('./LabCombo');
const InsuranceCompany = require('./InsuranceCompany');
const InsurancePolicy = require('./InsurancePolicy');
const InsuranceClaim = require('./InsuranceClaim');
const DoctorFee = require('./DoctorFee');
const AccountChart = require('./AccountChart');
const JournalEntry = require('./JournalEntry');
const JournalItem = require('./JournalItem');
const TaxRetention = require('./TaxRetention');
const ClinicalService = require('./ClinicalService');
const Quote = require('./Quote');
const QuoteItem = require('./QuoteItem');
const Employee = require('./Employee');
const HospitalBed = require('./HospitalBed');
const Admission = require('./Admission');
const EmergencyTriage = require('./EmergencyTriage');
const HospitalStay = require('./HospitalStay');
const Surgery = require('./Surgery');
const InventoryItem = require('./InventoryItem');
const InventoryMovement = require('./InventoryMovement');
const ClinicalPackage = require('./ClinicalPackage');

// User - Role
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

// Department - Specialty
Department.hasMany(Specialty, { foreignKey: 'departmentId' });
Specialty.belongsTo(Department, { foreignKey: 'departmentId' });

// Doctor - Specialty
Specialty.hasMany(Doctor, { foreignKey: 'specialtyId' });
Doctor.belongsTo(Specialty, { foreignKey: 'specialtyId' });

// User - Profile Associations
User.hasOne(Doctor, { foreignKey: 'userId', onDelete: 'CASCADE' });
Doctor.belongsTo(User, { foreignKey: 'userId' });

Organization.hasMany(Doctor, { foreignKey: 'organizationId' });
Doctor.belongsTo(Organization, { foreignKey: 'organizationId' });

User.hasOne(Nurse, { foreignKey: 'userId', onDelete: 'CASCADE' });
Nurse.belongsTo(User, { foreignKey: 'userId' });

Organization.hasMany(Nurse, { foreignKey: 'organizationId' });
Nurse.belongsTo(Organization, { foreignKey: 'organizationId' });

User.hasOne(Staff, { foreignKey: 'userId', onDelete: 'CASCADE' });
Staff.belongsTo(User, { foreignKey: 'userId' });

Organization.hasMany(Staff, { foreignKey: 'organizationId' });
Staff.belongsTo(Organization, { foreignKey: 'organizationId' });

User.hasOne(Patient, { foreignKey: 'userId', onDelete: 'CASCADE' });
Patient.belongsTo(User, { foreignKey: 'userId' });

Organization.hasMany(Patient, { foreignKey: 'organizationId' });
Patient.belongsTo(Organization, { foreignKey: 'organizationId' });

// Clinical Associations
Patient.hasMany(MedicalRecord, { foreignKey: 'patientId' });
MedicalRecord.belongsTo(Patient, { foreignKey: 'patientId' });

Doctor.hasMany(MedicalRecord, { foreignKey: 'doctorId' });
MedicalRecord.belongsTo(Doctor, { foreignKey: 'doctorId' });

Patient.hasMany(LabResult, { foreignKey: 'patientId' });
LabResult.belongsTo(Patient, { foreignKey: 'patientId' });

MedicalRecord.hasMany(Prescription, { foreignKey: 'medicalRecordId', as: 'prescriptions' });
Prescription.belongsTo(MedicalRecord, { foreignKey: 'medicalRecordId' });

Drug.hasMany(Prescription, { foreignKey: 'drugId' });
Prescription.belongsTo(Drug, { foreignKey: 'drugId', as: 'drug' });

// Payment Associations
Patient.hasMany(Payment, { foreignKey: 'patientId' });
Payment.belongsTo(Patient, { foreignKey: 'patientId' });

Organization.hasMany(Payment, { foreignKey: 'organizationId' });
Payment.belongsTo(Organization, { foreignKey: 'organizationId' });

Appointment.hasOne(Payment, { foreignKey: 'appointmentId' });
Payment.belongsTo(Appointment, { foreignKey: 'appointmentId' });

// Appointment links
Doctor.hasMany(Appointment, { foreignKey: 'doctorId' });
Appointment.belongsTo(Doctor, { foreignKey: 'doctorId' });

Patient.hasMany(Appointment, { foreignKey: 'patientId' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId' });

// VideoConsultation Associations
User.hasMany(VideoConsultation, { as: 'doctorConsultations', foreignKey: 'doctorId' });
User.hasMany(VideoConsultation, { as: 'patientConsultations', foreignKey: 'patientId' });

VideoConsultation.belongsTo(User, { as: 'doctor', foreignKey: 'doctorId' });
VideoConsultation.belongsTo(User, { as: 'patient', foreignKey: 'patientId' });
VideoConsultation.belongsTo(Appointment, { foreignKey: 'appointmentId' });

Appointment.hasOne(VideoConsultation, { foreignKey: 'appointmentId' });

// Organization Associations
User.belongsTo(Organization, { foreignKey: 'organizationId' });
Organization.hasMany(User, { foreignKey: 'organizationId' });
Organization.belongsTo(User, { as: 'owner', foreignKey: 'ownerId' });

// Laboratory Catalog Associations
LabCombo.belongsToMany(LabTest, { 
  through: 'LabComboTests', 
  foreignKey: 'comboId',
  otherKey: 'testId',
  as: 'tests'
});
LabTest.belongsToMany(LabCombo, { 
  through: 'LabComboTests', 
  foreignKey: 'testId',
  otherKey: 'comboId',
  as: 'combos'
});

// Insurance Associations
Organization.hasMany(InsuranceCompany, { foreignKey: 'organizationId' });
InsuranceCompany.belongsTo(Organization, { foreignKey: 'organizationId' });

InsuranceCompany.hasMany(InsurancePolicy, { foreignKey: 'insuranceCompanyId' });
InsurancePolicy.belongsTo(InsuranceCompany, { foreignKey: 'insuranceCompanyId' });

Patient.hasMany(InsurancePolicy, { foreignKey: 'patientId' });
InsurancePolicy.belongsTo(Patient, { foreignKey: 'patientId' });

Patient.belongsTo(InsuranceCompany, { foreignKey: 'insuranceCompanyId' });
InsuranceCompany.hasMany(Patient, { foreignKey: 'insuranceCompanyId' });

Organization.hasMany(InsuranceClaim, { foreignKey: 'organizationId' });
InsuranceClaim.belongsTo(Organization, { foreignKey: 'organizationId' });

InsuranceCompany.hasMany(InsuranceClaim, { foreignKey: 'insuranceCompanyId' });
InsuranceClaim.belongsTo(InsuranceCompany, { foreignKey: 'insuranceCompanyId' });

Patient.hasMany(InsuranceClaim, { foreignKey: 'patientId' });
InsuranceClaim.belongsTo(Patient, { foreignKey: 'patientId' });

Doctor.hasMany(InsuranceClaim, { foreignKey: 'doctorId' });
InsuranceClaim.belongsTo(Doctor, { foreignKey: 'doctorId' });

// Doctor Fees Associations
Organization.hasMany(DoctorFee, { foreignKey: 'organizationId' });
DoctorFee.belongsTo(Organization, { foreignKey: 'organizationId' });

Doctor.hasMany(DoctorFee, { foreignKey: 'doctorId' });
DoctorFee.belongsTo(Doctor, { foreignKey: 'doctorId' });

Patient.hasMany(DoctorFee, { foreignKey: 'patientId' });
DoctorFee.belongsTo(Patient, { foreignKey: 'patientId' });

Payment.hasOne(DoctorFee, { foreignKey: 'paymentId' });
DoctorFee.belongsTo(Payment, { foreignKey: 'paymentId' });

DoctorFee.belongsTo(InsuranceCompany, { foreignKey: 'insuranceCompanyId' });
InsuranceCompany.hasMany(DoctorFee, { foreignKey: 'insuranceCompanyId' });

DoctorFee.belongsTo(ClinicalService, { foreignKey: 'clinicalServiceId' });
ClinicalService.hasMany(DoctorFee, { foreignKey: 'clinicalServiceId' });

// Venezuelan Accounting Associations
Organization.hasMany(AccountChart, { foreignKey: 'organizationId' });
AccountChart.belongsTo(Organization, { foreignKey: 'organizationId' });

Organization.hasMany(JournalEntry, { foreignKey: 'organizationId' });
JournalEntry.belongsTo(Organization, { foreignKey: 'organizationId' });

JournalEntry.hasMany(JournalItem, { foreignKey: 'journalEntryId', as: 'items', onDelete: 'CASCADE' });
JournalItem.belongsTo(JournalEntry, { foreignKey: 'journalEntryId' });

AccountChart.hasMany(JournalItem, { foreignKey: 'accountId' });
JournalItem.belongsTo(AccountChart, { foreignKey: 'accountId' });

Organization.hasMany(TaxRetention, { foreignKey: 'organizationId' });
TaxRetention.belongsTo(Organization, { foreignKey: 'organizationId' });

// Clinical Services & Quotes
Organization.hasMany(ClinicalService, { foreignKey: 'organizationId' });
ClinicalService.belongsTo(Organization, { foreignKey: 'organizationId' });

Specialty.hasMany(ClinicalService, { foreignKey: 'specialtyId' });
ClinicalService.belongsTo(Specialty, { foreignKey: 'specialtyId' });

Organization.hasMany(Quote, { foreignKey: 'organizationId' });
Quote.belongsTo(Organization, { foreignKey: 'organizationId' });

Quote.hasMany(QuoteItem, { foreignKey: 'quoteId', as: 'items', onDelete: 'CASCADE' });
QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId' });

Patient.hasMany(Quote, { foreignKey: 'patientId' });
Quote.belongsTo(Patient, { foreignKey: 'patientId' });

Doctor.hasMany(Quote, { foreignKey: 'doctorId' });
Quote.belongsTo(Doctor, { foreignKey: 'doctorId' });

InsuranceCompany.hasMany(Quote, { foreignKey: 'insuranceCompanyId' });
Quote.belongsTo(InsuranceCompany, { foreignKey: 'insuranceCompanyId' });

Organization.hasMany(ClinicalPackage, { foreignKey: 'organizationId' });
ClinicalPackage.belongsTo(Organization, { foreignKey: 'organizationId' });

// Employees & Synchronization
Organization.hasMany(Employee, { foreignKey: 'organizationId' });
Employee.belongsTo(Organization, { foreignKey: 'organizationId' });

Employee.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(Employee, { foreignKey: 'userId' });

Employee.belongsTo(Doctor, { foreignKey: 'doctorId' });
Doctor.hasOne(Employee, { foreignKey: 'doctorId' });

Employee.belongsTo(Department, { foreignKey: 'departmentId' });
Department.hasMany(Employee, { foreignKey: 'departmentId' });

Employee.belongsTo(Specialty, { foreignKey: 'specialtyId' });
Specialty.hasMany(Employee, { foreignKey: 'specialtyId' });

// Hospital & Clinical Modules (Beds, Admissions, Triage, Stays, Surgeries)
Organization.hasMany(HospitalBed, { foreignKey: 'organizationId' });
HospitalBed.belongsTo(Organization, { foreignKey: 'organizationId' });

HospitalBed.belongsTo(Patient, { foreignKey: 'currentPatientId', as: 'currentPatient' });

Organization.hasMany(Admission, { foreignKey: 'organizationId' });
Admission.belongsTo(Organization, { foreignKey: 'organizationId' });

Patient.hasMany(Admission, { foreignKey: 'patientId' });
Admission.belongsTo(Patient, { foreignKey: 'patientId' });

Doctor.hasMany(Admission, { foreignKey: 'attendingDoctorId' });
Admission.belongsTo(Doctor, { foreignKey: 'attendingDoctorId' });

InsuranceCompany.hasMany(Admission, { foreignKey: 'insuranceCompanyId' });
Admission.belongsTo(InsuranceCompany, { foreignKey: 'insuranceCompanyId' });

Admission.hasOne(EmergencyTriage, { foreignKey: 'admissionId' });
EmergencyTriage.belongsTo(Admission, { foreignKey: 'admissionId' });

Patient.hasMany(EmergencyTriage, { foreignKey: 'patientId' });
EmergencyTriage.belongsTo(Patient, { foreignKey: 'patientId' });

Doctor.hasMany(EmergencyTriage, { foreignKey: 'assignedDoctorId' });
EmergencyTriage.belongsTo(Doctor, { foreignKey: 'assignedDoctorId' });

Admission.hasMany(HospitalStay, { foreignKey: 'admissionId' });
HospitalStay.belongsTo(Admission, { foreignKey: 'admissionId' });

HospitalBed.hasMany(HospitalStay, { foreignKey: 'bedId' });
HospitalStay.belongsTo(HospitalBed, { foreignKey: 'bedId' });

Patient.hasMany(HospitalStay, { foreignKey: 'patientId' });
HospitalStay.belongsTo(Patient, { foreignKey: 'patientId' });

Doctor.hasMany(HospitalStay, { foreignKey: 'attendingDoctorId' });
HospitalStay.belongsTo(Doctor, { foreignKey: 'attendingDoctorId' });

Admission.hasMany(Surgery, { foreignKey: 'admissionId' });
Surgery.belongsTo(Admission, { foreignKey: 'admissionId' });

Patient.hasMany(Surgery, { foreignKey: 'patientId' });
Surgery.belongsTo(Patient, { foreignKey: 'patientId' });

Specialty.hasMany(Surgery, { foreignKey: 'specialtyId' });
Surgery.belongsTo(Specialty, { foreignKey: 'specialtyId' });

Doctor.hasMany(Surgery, { as: 'leadSurgeries', foreignKey: 'leadSurgeonId' });
Surgery.belongsTo(Doctor, { as: 'leadSurgeon', foreignKey: 'leadSurgeonId' });

Doctor.hasMany(Surgery, { as: 'assistantSurgeries', foreignKey: 'assistantSurgeonId' });
Surgery.belongsTo(Doctor, { as: 'assistantSurgeon', foreignKey: 'assistantSurgeonId' });

Doctor.hasMany(Surgery, { as: 'anesthesiaSurgeries', foreignKey: 'anesthesiologistId' });
Surgery.belongsTo(Doctor, { as: 'anesthesiologist', foreignKey: 'anesthesiologistId' });

// Inventory & Products / Services Associations
Organization.hasMany(InventoryItem, { foreignKey: 'organizationId' });
InventoryItem.belongsTo(Organization, { foreignKey: 'organizationId' });

Specialty.hasMany(InventoryItem, { foreignKey: 'specialtyId' });
InventoryItem.belongsTo(Specialty, { foreignKey: 'specialtyId' });

Doctor.hasMany(InventoryItem, { foreignKey: 'doctorId' });
InventoryItem.belongsTo(Doctor, { foreignKey: 'doctorId' });

InventoryItem.hasMany(InventoryMovement, { foreignKey: 'itemId', as: 'movements' });
InventoryMovement.belongsTo(InventoryItem, { foreignKey: 'itemId' });

Organization.hasMany(InventoryMovement, { foreignKey: 'organizationId' });
InventoryMovement.belongsTo(Organization, { foreignKey: 'organizationId' });

Patient.hasMany(InventoryMovement, { foreignKey: 'patientId' });
InventoryMovement.belongsTo(Patient, { foreignKey: 'patientId' });

Doctor.hasMany(InventoryMovement, { foreignKey: 'doctorId' });
InventoryMovement.belongsTo(Doctor, { foreignKey: 'doctorId' });

DoctorFee.hasOne(InventoryMovement, { foreignKey: 'doctorFeeId' });
InventoryMovement.belongsTo(DoctorFee, { foreignKey: 'doctorFeeId' });

// Global Isolation Hook (SaaS Multi-tenant)
const context = require('../utils/context');
const AuditTrail = require('../utils/auditTrail');

/**
 * Automatically inject organizationId filter into all queries
 * Excludes SUPERADMIN or explicit unscoped queries
 */
sequelize.addHook('beforeFind', (options) => {
  try {
    const orgId = context.getOrgId();
    const role = context.getRole();

    // Skip if no orgId in context or user is a Super Admin or Platform Admin
    if (!orgId || role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN') {
      return;
    }

    // Ensure 'where' exists
    options.where = options.where || {};

    // If the model has an 'organizationId' attribute, inject it
    if (options.model?.rawAttributes?.organizationId) {
      if (typeof options.where.organizationId === 'undefined') {
         options.where.organizationId = orgId;
      }
    }
  } catch (err) {
    console.error('Sequelize beforeFind Hook Error:', err);
  }
});

module.exports = {
  User,
  Role,
  Department,
  Specialty,
  Doctor,
  Patient,
  Nurse,
  Staff,
  Appointment,
  MedicalRecord,
  LabResult,
  Payment,
  VideoConsultation,
  Organization,
  AuditLog,
  Drug,
  Prescription,
  LabTest,
  LabCombo,
  InsuranceCompany,
  InsurancePolicy,
  InsuranceClaim,
  DoctorFee,
  AccountChart,
  JournalEntry,
  JournalItem,
  TaxRetention,
  ClinicalService,
  Quote,
  QuoteItem,
  Employee,
  HospitalBed,
  Admission,
  EmergencyTriage,
  HospitalStay,
  Surgery,
  InventoryItem,
  InventoryMovement,
  ClinicalPackage,
  sequelize
};
