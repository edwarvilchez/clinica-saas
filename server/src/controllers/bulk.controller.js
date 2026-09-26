const { User, Patient, Doctor, LabTest, Role, Specialty, sequelize } = require('../models');
const fs = require('fs');
const { isCsvFile, isXlsxFile, validateRecord, parseCsv, parseXlsx } = require('../services/importService');

exports.importData = async (req, res) => {
  const { type } = req.params;
  const filePath = req.file ? req.file.path : null;
  const errors = [];
  let successCount = 0;

  const dryRun = req.query.dryRun === 'true' || req.body.dryRun === 'true' || req.body.dryRun === true;

  if (!filePath) {
    return res.status(400).json({ message: 'Se requiere subir un archivo CSV o Excel válido' });
  }

  const { organizationId, role } = req.user;
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';
  const userOrgId = isSuperAdmin ? null : organizationId;

  try {
    let records = [];
    if (isCsvFile(filePath)) records = await parseCsv(filePath);
    else if (isXlsxFile(filePath)) records = await parseXlsx(filePath);
    else throw new Error('Formato de archivo no soportado. Debe ser CSV o Excel (.xlsx)');

    if (records.length > 5000) throw new Error('El archivo excede el máximo permitido de 5,000 filas');

    let rowIndex = 1;
    for (const record of records) {
      rowIndex++;
      const validationErrors = validateRecord(type, record, rowIndex);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        continue;
      }

      const t = await sequelize.transaction();
      try {
        if (type === 'patients') await importPatient(record, t, userOrgId);
        else if (type === 'doctors') await importDoctor(record, t, userOrgId);
        else if (type === 'lab_catalog') await importLabTest(record, t, userOrgId);
        else if (type === 'pharmacy_inventory' || type === 'inventory') await importInventoryItem(record, t, userOrgId);
        else if (type === 'insurance_companies') await importInsuranceCompany(record, t, userOrgId);
        else if (type === 'baremos') await importBaremoService(record, t, userOrgId);
        else throw new Error(`Tipo de importación inválido: ${type}`);

        if (dryRun) {
          await t.rollback(); // En modo simulación siempre revertimos cambios
        } else {
          await t.commit();
        }
        successCount++;
      } catch (err) {
        await t.rollback();
        errors.push({ row: rowIndex, field: 'transaction', message: err.message });
      }
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({
      dryRun,
      message: dryRun 
        ? `Simulación finalizada: ${successCount} filas válidas, ${errors.length} filas con error.` 
        : `Importación completada: ${successCount} exitosas, ${errors.length} fallidas.`,
      totalRows: records.length,
      successCount,
      errorCount: errors.length,
      canProceed: errors.length === 0,
      errors
    });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
        password: data.password || 'MedicalCare888!', 
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
        allergies: data.allergies,
        organizationId
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
        password: data.password || 'MedicalCare888!',
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

async function importLabTest(data, transaction, organizationId) {
    await LabTest.create({
        name: data.name,
        price: parseFloat(data.price),
        category: data.category || 'General',
        description: data.description || '',
        organizationId
    }, { transaction });
}

async function importPharmacyItem(data, transaction, organizationId) {
    const { Drug } = require('../models');
    if (Drug) {
        await Drug.create({
            name: data.name,
            genericName: data.genericName || data.name,
            dosageForm: data.dosageForm || 'Tabletas',
            presentation: data.presentation || 'Caja',
            stock: parseInt(data.stock) || 0,
            organizationId
        }, { transaction });
    }
}

async function importInsuranceCompany(data, transaction, organizationId) {
    const { InsuranceCompany } = require('../models');
    if (InsuranceCompany) {
        await InsuranceCompany.create({
            name: data.name,
            rif: data.rif,
            phone: data.phone || null,
            email: data.email || null,
            contactPerson: data.contactPerson || null,
            defaultCoveragePercent: parseFloat(data.defaultCoveragePercent) || 80.00,
            paymentTermDays: parseInt(data.paymentTermDays) || 30,
            notes: data.notes || null,
            isActive: true,
            organizationId
        }, { transaction });
    }
}

async function importInventoryItem(data, transaction, organizationId) {
    const { InventoryItem } = require('../models');
    if (InventoryItem) {
        const code = data.code || `ITM-${Math.floor(1000 + Math.random() * 9000)}`;
        await InventoryItem.create({
            code,
            name: data.name,
            nameEn: data.nameEn || null,
            itemType: data.itemType || 'PRODUCT',
            category: data.category || 'MEDICINE',
            unit: data.unit || 'UNIDAD',
            costUSD: parseFloat(data.costUSD) || 0.00,
            priceUSD: parseFloat(data.priceUSD) || 0.00,
            stockCurrent: parseFloat(data.stockCurrent) || 0.00,
            stockMin: parseFloat(data.stockMin) || 5.00,
            batchNumber: data.batchNumber || null,
            expiryDate: data.expiryDate || null,
            location: data.location || 'Almacén General',
            isTaxExempt: data.isTaxExempt !== 'false' && data.isTaxExempt !== false,
            isActive: true,
            organizationId
        }, { transaction });
    }
}

async function importBaremoService(data, transaction, organizationId) {
    const { ClinicalService, InventoryItem } = require('../models');
    const code = data.code || `SRV-${Math.floor(1000 + Math.random() * 9000)}`;
    const priceUSD = parseFloat(data.priceUSD) || 0.00;
    const doctorFeePercent = parseFloat(data.doctorFeePercent) || 70.00;
    const doctorFeeFixedUSD = parseFloat(data.doctorFeeFixedUSD) || 0.00;

    if (ClinicalService) {
        await ClinicalService.create({
            code,
            name: data.name,
            category: data.category || 'CONSULTATION',
            description: data.description || '',
            priceUSD,
            isTaxExempt: true,
            taxRate: 0.00,
            requiresDoctor: true,
            isActive: true,
            organizationId
        }, { transaction });
    }

    if (InventoryItem) {
        await InventoryItem.create({
            code,
            name: data.name,
            itemType: 'SERVICE',
            category: data.category || 'CONSULTATION',
            unit: 'SERVICIO',
            costUSD: 0.00,
            priceUSD,
            stockCurrent: 9999,
            stockMin: 0,
            isTaxExempt: true,
            doctorFeePercent,
            doctorFeeFixedUSD,
            requiresDoctor: true,
            isActive: true,
            organizationId
        }, { transaction });
    }
}

