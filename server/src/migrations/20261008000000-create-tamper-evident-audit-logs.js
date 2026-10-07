'use strict';

/**
 * 🛡️ FASE 2 MIGRATION: Tamper-Evident Append-Only Audit Trail
 * Creates the audit_logs table with UUID identifiers, SHA-256 hash chaining columns,
 * Row Level Security (RLS) tenant isolation, and a PostgreSQL trigger enforcing
 * hardware/engine-level immutability (blocking UPDATE and DELETE).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Ensure clean table creation
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS audit_logs CASCADE;
    `);

    // 2. Create audit_logs table with UUIDs and cryptographic hash fields
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      actorUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      entity: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      entityId: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      oldValues: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      newValues: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      changes: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      requestId: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      previousHash: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      currentHash: {
        type: Sequelize.STRING(64),
        allowNull: false
      }
    });

    // 3. Add Performance & Compliance Indexes
    await queryInterface.addIndex('audit_logs', ['organizationId', 'timestamp'], {
      name: 'idx_audit_logs_org_timestamp'
    });
    await queryInterface.addIndex('audit_logs', ['actorUserId', 'timestamp'], {
      name: 'idx_audit_logs_actor_timestamp'
    });
    await queryInterface.addIndex('audit_logs', ['entity', 'entityId'], {
      name: 'idx_audit_logs_entity'
    });
    await queryInterface.addIndex('audit_logs', ['action'], {
      name: 'idx_audit_logs_action'
    });
    await queryInterface.addIndex('audit_logs', ['timestamp'], {
      name: 'idx_audit_logs_timestamp'
    });
    await queryInterface.addIndex('audit_logs', ['currentHash'], {
      name: 'idx_audit_logs_current_hash'
    });

    // 4. Enforce Row Level Security (RLS) on audit_logs
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;
      CREATE POLICY tenant_isolation_policy ON audit_logs
      AS PERMISSIVE
      FOR ALL
      TO PUBLIC
      USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR
        "organizationId"::text = NULLIF(current_setting('app.current_organization_id', true), '')
      )
      WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR
        "organizationId"::text = NULLIF(current_setting('app.current_organization_id', true), '')
      );
    `);

    // 5. Enforce Append-Only Immutability via PostgreSQL Trigger
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit logs are strictly append-only: modifications and deletions are forbidden by security policy.';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_logs;
      CREATE TRIGGER trg_prevent_audit_log_mutation
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_tampering();
    `);

    console.log('✅ Tamper-evident, append-only audit_logs table created with RLS and trigger enforcement');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_logs;
      DROP FUNCTION IF EXISTS prevent_audit_log_tampering();
    `);
    await queryInterface.dropTable('audit_logs');
  }
};
