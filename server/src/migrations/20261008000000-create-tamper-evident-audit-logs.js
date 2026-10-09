'use strict';

/**
 * 🛡️ FASE 2 MIGRATION: Tamper-Evident Append-Only Audit Trail (Non-Destructive & Incremental)
 * Safely creates or updates the audit_logs table with UUID identifiers, SHA-256 hash chaining columns,
 * Row Level Security (RLS) tenant isolation, and a PostgreSQL trigger enforcing
 * hardware/engine-level immutability (blocking UPDATE and DELETE).
 *
 * NOTE: Preserves existing historical audit logs, timestamps, and hashes.
 * NEVER uses DROP TABLE, TRUNCATE, or data-destructive operations.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('audit_logs');

    if (!tableExists) {
      // 1. Brand new table creation with UUIDs and cryptographic hash fields
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
    } else {
      // 2. Safe Incremental Migration for Existing Schema (Preserves all historical rows)
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_logs;
      `);

      const tableDescription = await queryInterface.describeTable('audit_logs');

      // 2.1 Migrate ID to UUID if previously integer, preserving row identity deterministically
      if (tableDescription.id && !tableDescription.id.type.includes('UUID')) {
        await queryInterface.sequelize.query(`
          ALTER TABLE audit_logs ALTER COLUMN id DROP DEFAULT;
          ALTER TABLE audit_logs ALTER COLUMN id TYPE UUID USING (
            CASE 
              WHEN id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::text::uuid
              ELSE md5('audit_log_' || id::text)::uuid
            END
          );
          ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
        `);
      }

      // 2.2 Add organizationId if missing
      if (!tableDescription.organizationId) {
        await queryInterface.addColumn('audit_logs', 'organizationId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Organizations',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        });
      }

      // 2.3 Add actorUserId if missing
      if (!tableDescription.actorUserId) {
        await queryInterface.addColumn('audit_logs', 'actorUserId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        });

        if (tableDescription.userId) {
          try {
            await queryInterface.sequelize.query(`
              UPDATE audit_logs SET "actorUserId" = "userId"::text::uuid
              WHERE "userId" IS NOT NULL AND "userId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
            `);
          } catch (_) {
            // Keep existing data untouched if user mapping cannot be cast
          }
        }
      }

      // 2.4 Widen action and entity if needed
      if (tableDescription.action) {
        await queryInterface.sequelize.query(`
          ALTER TABLE audit_logs ALTER COLUMN action TYPE VARCHAR(100);
        `);
      }
      if (tableDescription.entity) {
        await queryInterface.sequelize.query(`
          ALTER TABLE audit_logs ALTER COLUMN entity TYPE VARCHAR(100);
        `);
      }
      if (tableDescription.entityId) {
        await queryInterface.sequelize.query(`
          ALTER TABLE audit_logs ALTER COLUMN "entityId" TYPE VARCHAR(255);
        `);
      }

      // 2.5 Add requestId and metadata if missing
      if (!tableDescription.requestId) {
        await queryInterface.addColumn('audit_logs', 'requestId', {
          type: Sequelize.STRING(100),
          allowNull: true
        });
      }
      if (!tableDescription.metadata) {
        await queryInterface.addColumn('audit_logs', 'metadata', {
          type: Sequelize.JSONB,
          allowNull: true
        });
      }

      // 2.6 Add cryptographic hash chaining columns (allowNull: true to preserve historical unhashed records)
      if (!tableDescription.previousHash) {
        await queryInterface.addColumn('audit_logs', 'previousHash', {
          type: Sequelize.STRING(64),
          allowNull: true
        });
      } else {
        await queryInterface.sequelize.query(`
          ALTER TABLE audit_logs ALTER COLUMN "previousHash" DROP NOT NULL;
        `);
      }

      if (!tableDescription.currentHash) {
        await queryInterface.addColumn('audit_logs', 'currentHash', {
          type: Sequelize.STRING(64),
          allowNull: true
        });
      } else {
        await queryInterface.sequelize.query(`
          ALTER TABLE audit_logs ALTER COLUMN "currentHash" DROP NOT NULL;
        `);
      }

      // 2.7 Transparent historical inspection: preserve evidence without inventing fake cryptographic integrity
      const [hashStats] = await queryInterface.sequelize.query(`
        SELECT 
          COUNT(*)::int as total_rows,
          COUNT(*) FILTER (WHERE "currentHash" IS NULL)::int as null_hashes,
          COUNT(*) FILTER (WHERE "currentHash" IS NOT NULL)::int as hashed_rows
        FROM audit_logs;
      `);

      const stats = hashStats[0] || { total_rows: 0, null_hashes: 0, hashed_rows: 0 };
      console.log(`[Migration Audit] Historical audit inspection: Total: ${stats.total_rows}, Legacy Unhashed: ${stats.null_hashes}, Cryptographically Hashed: ${stats.hashed_rows}`);

      if (stats.null_hashes > 0) {
        console.log(`[Migration Audit] ⚠️ Preserving ${stats.null_hashes} legacy audit entries without fabricating synthetic hashes. Integrity status transparently recorded.`);
        
        // Transparently annotate legacy migration status in metadata without modifying raw evidence
        await queryInterface.sequelize.query(`
          UPDATE audit_logs
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{migrationStatus}',
            '"PRESERVED_HISTORICAL_UNHASHED"'::jsonb,
            true
          )
          WHERE "currentHash" IS NULL;
        `);
      }
    }

    // 3. Performance & Compliance Indexes (Using IF NOT EXISTS for complete idempotency)
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp ON audit_logs ("organizationId", "timestamp");',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_timestamp ON audit_logs ("actorUserId", "timestamp");',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs ("entity", "entityId");',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs ("action");',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs ("timestamp");',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_current_hash ON audit_logs ("currentHash");'
    ];

    for (const sql of indexes) {
      await queryInterface.sequelize.query(sql);
    }

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

    console.log('✅ Tamper-evident, append-only audit_logs migration successfully executed without data loss');
  },

  down: async (queryInterface, Sequelize) => {
    // Non-destructive down: drop trigger and policies, never destroy historical audit table
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_logs;
      DROP FUNCTION IF EXISTS prevent_audit_log_tampering();
      DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;
    `);
  }
};
