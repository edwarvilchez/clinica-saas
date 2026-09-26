const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Employee = sequelize.define('Employee', {
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
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  employeeCode: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'EMP-0042'
  },
  documentId: {
    type: DataTypes.STRING,
    allowNull: false // Cédula de Identidad / Passport
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'Médico Cirujano', 'Enfermera Jefe', 'Recepcionista', 'Administrador'
  },
  departmentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Departments',
      key: 'id'
    }
  },
  isDoctor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Specialties',
      key: 'id'
    }
  },
  medicalLicense: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contractType: {
    type: DataTypes.ENUM('FULL_TIME', 'PART_TIME', 'PROFESSIONAL_FEES', 'CONTRACTOR', 'INTERN'),
    defaultValue: 'FULL_TIME'
  },
  baseSalaryUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  hireDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  terminationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'),
    defaultValue: 'ACTIVE'
  },
  emergencyContactName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emergencyContactPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  paranoid: true,
  indexes: [
    {
      fields: ['employeeCode', 'organizationId'],
      unique: true
    },
    {
      fields: ['documentId', 'organizationId'],
      unique: true
    }
  ]
});

module.exports = Employee;
