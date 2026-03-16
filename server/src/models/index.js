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

User.hasOne(Nurse, { foreignKey: 'userId', onDelete: 'CASCADE' });
Nurse.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Staff, { foreignKey: 'userId', onDelete: 'CASCADE' });
Staff.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Patient, { foreignKey: 'userId', onDelete: 'CASCADE' });
Patient.belongsTo(User, { foreignKey: 'userId' });

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
  sequelize
};
