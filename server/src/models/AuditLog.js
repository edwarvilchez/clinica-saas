'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

/**
 * 📜 AuditLog Model (Tamper-Evident Append-Only Audit Trail)
 * Stores immutable domain and security events with cryptographic SHA-256 hash chaining.
 */
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Organizations',
      key: 'id'
    }
  },
  actorUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  // Backward compatibility alias for userId
  userId: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('actorUserId');
    },
    set(val) {
      this.setDataValue('actorUserId', val);
    }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  entity: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  // Compatibility alias for entityType
  entityType: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('entity');
    },
    set(val) {
      this.setDataValue('entity', val);
    }
  },
  entityId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  oldValues: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  newValues: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  changes: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  ip: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  requestId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  previousHash: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  currentHash: {
    type: DataTypes.STRING(64),
    allowNull: false
  }
}, {
  tableName: 'audit_logs',
  timestamps: false,
  indexes: [
    { fields: ['organizationId', 'timestamp'] },
    { fields: ['actorUserId', 'timestamp'] },
    { fields: ['entity', 'entityId'] },
    { fields: ['action'] },
    { fields: ['timestamp'] },
    { fields: ['currentHash'] }
  ],
  hooks: {
    beforeUpdate: () => {
      throw new Error('Audit logs are strictly append-only: updates are prohibited by security policy.');
    },
    beforeBulkUpdate: () => {
      throw new Error('Audit logs are strictly append-only: updates are prohibited by security policy.');
    },
    beforeDestroy: () => {
      throw new Error('Audit logs are strictly append-only: deletions are prohibited by security policy.');
    },
    beforeBulkDestroy: () => {
      throw new Error('Audit logs are strictly append-only: deletions are prohibited by security policy.');
    }
  }
});

module.exports = AuditLog;
