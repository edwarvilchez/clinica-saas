const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  tokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  family: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  replacedByTokenHash: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  ip: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
  indexes: [
    { fields: ['tokenHash'] },
    { fields: ['userId'] },
    { fields: ['family'] }
  ]
});

module.exports = RefreshToken;
