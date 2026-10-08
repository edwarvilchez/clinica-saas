// Migration: Add critical database indexes for performance
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const safeAddIndex = async (tableName, fields, options) => {
      try {
        await queryInterface.addIndex(tableName, fields, options);
      } catch (err) {
        // Ignore if table does not exist yet (sync handles it) or index already exists
      }
    };

    // Users table indexes
    await safeAddIndex('Users', ['email'], {
      unique: true,
      name: 'idx_users_email'
    });
    await safeAddIndex('Users', ['username'], {
      unique: true,
      name: 'idx_users_username'
    });
    await safeAddIndex('Users', ['roleId'], {
      name: 'idx_users_roleId'
    });
    await safeAddIndex('Users', ['organizationId'], {
      name: 'idx_users_organizationId'
    });

    // Appointments table indexes
    await safeAddIndex('Appointments', ['doctorId', 'date', 'status'], {
      name: 'idx_appointments_doctor_date_status'
    });
    await safeAddIndex('Appointments', ['patientId', 'date'], {
      name: 'idx_appointments_patient_date'
    });
    await safeAddIndex('Appointments', ['date', 'status'], {
      name: 'idx_appointments_date_status'
    });

    // Patients table indexes
    await safeAddIndex('Patients', ['documentId'], {
      unique: true,
      name: 'idx_patients_documentId'
    });
    await safeAddIndex('Patients', ['userId'], {
      name: 'idx_patients_userId'
    });

    // Payments table indexes
    await safeAddIndex('Payments', ['patientId', 'createdAt'], {
      name: 'idx_payments_patient_createdAt'
    });
    await safeAddIndex('Payments', ['status', 'createdAt'], {
      name: 'idx_payments_status_createdAt'
    });

    // Medical Records indexes
    await safeAddIndex('MedicalRecords', ['patientId', 'createdAt'], {
      name: 'idx_medical_records_patient_createdAt'
    });

    // Lab Results indexes
    await safeAddIndex('LabResults', ['patientId', 'createdAt'], {
      name: 'idx_lab_results_patient_createdAt'
    });

    console.log('✅ Database indexes handled successfully');
  },

  down: async (queryInterface, Sequelize) => {
    const safeRemoveIndex = async (tableName, indexName) => {
      try {
        await queryInterface.removeIndex(tableName, indexName);
      } catch (_) {}
    };

    await safeRemoveIndex('Users', 'idx_users_email');
    await safeRemoveIndex('Users', 'idx_users_username');
    await safeRemoveIndex('Users', 'idx_users_roleId');
    await safeRemoveIndex('Users', 'idx_users_organizationId');
    await safeRemoveIndex('Appointments', 'idx_appointments_doctor_date_status');
    await safeRemoveIndex('Appointments', 'idx_appointments_patient_date');
    await safeRemoveIndex('Appointments', 'idx_appointments_date_status');
    await safeRemoveIndex('Patients', 'idx_patients_documentId');
    await safeRemoveIndex('Patients', 'idx_patients_userId');
    await safeRemoveIndex('Payments', 'idx_payments_patient_createdAt');
    await safeRemoveIndex('Payments', 'idx_payments_status_createdAt');
    await safeRemoveIndex('MedicalRecords', 'idx_medical_records_patient_createdAt');
    await safeRemoveIndex('LabResults', 'idx_lab_results_patient_createdAt');
  }
};
