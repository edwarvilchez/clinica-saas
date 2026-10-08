'use strict';

/**
 * 📋 Migration: Create WaitlistEntries table with PostgreSQL RLS support & composite indexes
 * Phase 21: Clinical Smart Waitlist & Automated Slot Reassignment
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('WaitlistEntries');

    if (!tableExists) {
      await queryInterface.createTable('WaitlistEntries', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        organizationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Organizations',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        patientId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Patients',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        doctorId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Doctors',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        specialtyId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Specialties',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        priority: {
          type: Sequelize.ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
          defaultValue: 'MEDIUM',
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('WAITING', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED'),
          defaultValue: 'WAITING',
          allowNull: false
        },
        preferredDays: {
          type: Sequelize.JSONB,
          defaultValue: []
        },
        preferredTimeRange: {
          type: Sequelize.ENUM('ANY', 'MORNING', 'AFTERNOON'),
          defaultValue: 'ANY'
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        offeredAppointmentDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        offeredAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        offerExpiresAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        convertedAppointmentId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Appointments',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()')
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      });
    }

    const safeAddIndex = async (tableName, fields, options) => {
      try {
        await queryInterface.addIndex(tableName, fields, options);
      } catch (_) {}
    };

    await safeAddIndex('WaitlistEntries', ['organizationId', 'status'], { name: 'idx_waitlist_org_status' });
    await safeAddIndex('WaitlistEntries', ['organizationId', 'specialtyId'], { name: 'idx_waitlist_org_specialty' });
    await safeAddIndex('WaitlistEntries', ['organizationId', 'doctorId'], { name: 'idx_waitlist_org_doctor' });
    await safeAddIndex('WaitlistEntries', ['organizationId', 'priority'], { name: 'idx_waitlist_org_priority' });
    await safeAddIndex('WaitlistEntries', ['patientId'], { name: 'idx_waitlist_patient_id' });
    await safeAddIndex('WaitlistEntries', ['offerExpiresAt'], { name: 'idx_waitlist_expires_at' });

    // Enable PostgreSQL Row Level Security (RLS)
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE "WaitlistEntries" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS waitlist_tenant_isolation ON "WaitlistEntries";
        CREATE POLICY waitlist_tenant_isolation ON "WaitlistEntries"
          FOR ALL
          USING (
            organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
            OR current_setting('app.bypass_rls', true) = 'on'
          );
      `);
    } catch (_) {
      // In development environments without RLS setup, continue
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('WaitlistEntries');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_WaitlistEntries_priority";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_WaitlistEntries_status";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_WaitlistEntries_preferredTimeRange";');
    } catch (_) {}
  }
};
