'use strict';

/**
 * Migration: Add composite performance indexes for multi-tenant queries and high-churn foreign keys.
 * Phase 11 Database Optimization & Multi-Tenant Query Acceleration.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const safeAddIndex = async (tableName, fields, options) => {
      try {
        await queryInterface.addIndex(tableName, fields, options);
      } catch (err) {
        // Ignore duplicate index errors to allow idempotency across language locales (42P07)
        const msg = (err.message || '').toLowerCase();
        if (
          err.parent?.code === '42P07' ||
          msg.includes('already exists') ||
          msg.includes('ya existe') ||
          msg.includes('duplicate')
        ) {
          return;
        }
        throw err;
      }
    };

    // 1. Appointments composite indexes
    await safeAddIndex('Appointments', ['organizationId', 'createdAt'], {
      name: 'idx_appointments_org_created_at'
    });
    await safeAddIndex('Appointments', ['organizationId', 'status'], {
      name: 'idx_appointments_org_status'
    });
    await safeAddIndex('Appointments', ['organizationId', 'date'], {
      name: 'idx_appointments_org_date'
    });
    await safeAddIndex('Appointments', ['organizationId', 'doctorId'], {
      name: 'idx_appointments_org_doctor'
    });
    await safeAddIndex('Appointments', ['organizationId', 'patientId'], {
      name: 'idx_appointments_org_patient'
    });

    // 2. Payments composite indexes
    await safeAddIndex('Payments', ['organizationId', 'createdAt'], {
      name: 'idx_payments_org_created_at'
    });
    await safeAddIndex('Payments', ['organizationId', 'status'], {
      name: 'idx_payments_org_status'
    });
    await safeAddIndex('Payments', ['organizationId', 'paymentType'], {
      name: 'idx_payments_org_payment_type'
    });
    await safeAddIndex('Payments', ['patientId'], {
      name: 'idx_payments_patient_id'
    });
    await safeAddIndex('Payments', ['appointmentId'], {
      name: 'idx_payments_appointment_id'
    });

    // 3. MedicalRecords composite indexes
    await safeAddIndex('MedicalRecords', ['organizationId', 'createdAt'], {
      name: 'idx_medical_records_org_created_at'
    });
    await safeAddIndex('MedicalRecords', ['organizationId', 'patientId'], {
      name: 'idx_medical_records_org_patient'
    });
    await safeAddIndex('MedicalRecords', ['organizationId', 'doctorId'], {
      name: 'idx_medical_records_org_doctor'
    });

    // 4. Prescriptions composite indexes
    await safeAddIndex('Prescriptions', ['organizationId', 'createdAt'], {
      name: 'idx_prescriptions_org_created_at'
    });
    await safeAddIndex('Prescriptions', ['organizationId', 'status'], {
      name: 'idx_prescriptions_org_status'
    });
    await safeAddIndex('Prescriptions', ['medicalRecordId'], {
      name: 'idx_prescriptions_medical_record_id'
    });

    // 5. Patients composite indexes
    await safeAddIndex('Patients', ['organizationId', 'createdAt'], {
      name: 'idx_patients_org_created_at'
    });

    // 6. Admissions composite indexes
    await safeAddIndex('Admissions', ['organizationId', 'createdAt'], {
      name: 'idx_admissions_org_created_at'
    });
    await safeAddIndex('Admissions', ['organizationId', 'status'], {
      name: 'idx_admissions_org_status'
    });
    await safeAddIndex('Admissions', ['organizationId', 'patientId'], {
      name: 'idx_admissions_org_patient'
    });
    await safeAddIndex('Admissions', ['patientId', 'status'], {
      name: 'idx_admissions_patient_status'
    });

    // 7. DoctorFees composite indexes
    await safeAddIndex('DoctorFees', ['organizationId', 'createdAt'], {
      name: 'idx_doctor_fees_org_created_at'
    });
    await safeAddIndex('DoctorFees', ['organizationId', 'status'], {
      name: 'idx_doctor_fees_org_status'
    });
    await safeAddIndex('DoctorFees', ['organizationId', 'doctorId'], {
      name: 'idx_doctor_fees_org_doctor'
    });
  },

  down: async (queryInterface, Sequelize) => {
    const safeRemoveIndex = async (tableName, indexName) => {
      try {
        await queryInterface.removeIndex(tableName, indexName);
      } catch (err) {
        // Ignore if does not exist
      }
    };

    // Appointments
    await safeRemoveIndex('Appointments', 'idx_appointments_org_created_at');
    await safeRemoveIndex('Appointments', 'idx_appointments_org_status');
    await safeRemoveIndex('Appointments', 'idx_appointments_org_date');
    await safeRemoveIndex('Appointments', 'idx_appointments_org_doctor');
    await safeRemoveIndex('Appointments', 'idx_appointments_org_patient');

    // Payments
    await safeRemoveIndex('Payments', 'idx_payments_org_created_at');
    await safeRemoveIndex('Payments', 'idx_payments_org_status');
    await safeRemoveIndex('Payments', 'idx_payments_org_payment_type');
    await safeRemoveIndex('Payments', 'idx_payments_patient_id');
    await safeRemoveIndex('Payments', 'idx_payments_appointment_id');

    // MedicalRecords
    await safeRemoveIndex('MedicalRecords', 'idx_medical_records_org_created_at');
    await safeRemoveIndex('MedicalRecords', 'idx_medical_records_org_patient');
    await safeRemoveIndex('MedicalRecords', 'idx_medical_records_org_doctor');

    // Prescriptions
    await safeRemoveIndex('Prescriptions', 'idx_prescriptions_org_created_at');
    await safeRemoveIndex('Prescriptions', 'idx_prescriptions_org_status');
    await safeRemoveIndex('Prescriptions', 'idx_prescriptions_medical_record_id');

    // Patients
    await safeRemoveIndex('Patients', 'idx_patients_org_created_at');

    // Admissions
    await safeRemoveIndex('Admissions', 'idx_admissions_org_created_at');
    await safeRemoveIndex('Admissions', 'idx_admissions_org_status');
    await safeRemoveIndex('Admissions', 'idx_admissions_org_patient');
    await safeRemoveIndex('Admissions', 'idx_admissions_patient_status');

    // DoctorFees
    await safeRemoveIndex('DoctorFees', 'idx_doctor_fees_org_created_at');
    await safeRemoveIndex('DoctorFees', 'idx_doctor_fees_org_status');
    await safeRemoveIndex('DoctorFees', 'idx_doctor_fees_org_doctor');
  }
};
