const { User, Patient, Doctor, Role, Specialty, sequelize } = require('../models');
const fs = require('fs');
const { isCsvFile, isXlsxFile, validateRecord, parseCsv, parseXlsx } = require('../services/importService');

exports.importData = async (req, res) => {
  const { type } = req.params;
  const filePath = req.file.path;
  const errors = [];
  let successCount = 0;

  const { organizationId, role } = req.user;
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

  // Non-superadmins must have an organization
  const userOrgId = isSuperAdmin ? null : organizationId;

  try {
    let records = [];
    if (isCsvFile(filePath)) records = await parseCsv(filePath);
    else if (isXlsxFile(filePath)) records = await parseXlsx(filePath);
    else throw new Error('Unsupported file format');

    if (records.length > 5000) throw new Error('Import too large; maximum 5000 rows allowed');

    for (const record of records) {
      const validation = validateRecord(type, record);
      if (validation.length) {
        errors.push({ record, error: validation.join('; ') });
        continue;
      }

      const t = await sequelize.transaction();
      try {
        if (type === 'patients') await importPatient(record, t, userOrgId);
        else if (type === 'doctors') await importDoctor(record, t, userOrgId);
        else throw new Error('Invalid import type');
        await t.commit();
        successCount++;
      } catch (err) {
        await t.rollback();
        errors.push({ record, error: err.message });
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      message: `Import completed: ${successCount} successful, ${errors.length} failed.`,
      successCount,
      errorCount: errors.length,
      errors
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: error.message });
  }
};

async function importPatient(data, transaction, organizationId) {
    const patientRole = await Role.findOne({ where: { name: 'PATIENT' } });
    if (!patientRole) throw new Error('Patient role not found');

    const user = await User.create({
        username: data.username,
        email: data.email,
        password: data.password || 'ClinicaSaaS123!', // Default password if not provided
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        roleId: patientRole.id,
        organizationId
    }, { transaction });

    await Patient.create({
        userId: user.id,
        documentId: data.documentId,
        birthDate: data.birthDate,
        gender: data.gender,
        phone: data.phone,
        address: data.address,
        bloodType: data.bloodType,
        allergies: data.allergies
    }, { transaction });
}

async function importDoctor(data, transaction, organizationId) {
    const doctorRole = await Role.findOne({ where: { name: 'DOCTOR' } });
    if (!doctorRole) throw new Error('Doctor role not found');

    let specialtyId = null;
    if (data.specialty) {
        const specialty = await Specialty.findOne({ where: { name: data.specialty } });
        if (specialty) {
            specialtyId = specialty.id;
        } else {
            const newSpec = await Specialty.create({ name: data.specialty }, { transaction });
            specialtyId = newSpec.id;
        }
    }

    const user = await User.create({
        username: data.username,
        email: data.email,
        password: data.password || 'ClinicaSaaS123!',
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        roleId: doctorRole.id,
        organizationId
    }, { transaction });

    await Doctor.create({
        userId: user.id,
        licenseNumber: data.licenseNumber,
        phone: data.phone,
        address: data.address,
        specialtyId: specialtyId
    }, { transaction });
}
