module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('audit_logs');
    if (!tableExists) {
      await queryInterface.createTable('audit_logs', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        entity: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        action: {
          type: Sequelize.ENUM('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT'),
          allowNull: false
        },
        entityId: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        userId: {
          type: Sequelize.INTEGER,
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
        timestamp: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });
    }

    const safeAddIndex = async (tableName, fields) => {
      try {
        await queryInterface.addIndex(tableName, fields);
      } catch (_) {
        // Ignore if already exists
      }
    };

    // Add indexes
    await safeAddIndex('audit_logs', ['entity', 'entityId']);
    await safeAddIndex('audit_logs', ['userId']);
    await safeAddIndex('audit_logs', ['timestamp']);
    await safeAddIndex('audit_logs', ['action']);

    console.log('✅ Audit logs table handled');
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('audit_logs');
    } catch (_) {}
  }
};
