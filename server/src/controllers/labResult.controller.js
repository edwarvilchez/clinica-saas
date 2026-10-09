const { LabResult, Patient, User } = require('../models');
const { getTenantTransaction } = require('../utils/tenantRls');

const validatePatientAccess = async (patientId, organizationId, role, transaction = null) => {
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
  if (isSuperAdmin || !organizationId) return true;

  const patient = await Patient.findByPk(patientId, { include: [User], transaction });
  if (!patient) return false;
  
  return patient.User?.organizationId === organizationId || patient.organizationId === organizationId;
};

exports.createLabResult = async (req, res) => {
  try {
    const { organizationId, role } = req.user || {};
    const { patientId } = req.body;
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const hasAccess = await validatePatientAccess(patientId, organizationId, role, t);
      if (!hasAccess) {
        const err = new Error('No tienes acceso a este paciente');
        err.status = 403;
        throw err;
      }

      req.body.organizationId = organizationId || req.body.organizationId;
      return await LabResult.create(req.body, { transaction: t });
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.getPatientLabs = async (req, res) => {
  try {
    const { organizationId, role } = req.user || {};
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const { patientId } = req.params;
    const withTx = getTenantTransaction(req);

    const labs = await withTx(async (t) => {
      const hasAccess = await validatePatientAccess(patientId, organizationId, role, t);
      if (!hasAccess) {
        const err = new Error('No tienes acceso a este paciente');
        err.status = 403;
        throw err;
      }

      const where = { patientId };
      if (!isSuperAdmin && organizationId) {
        where.organizationId = organizationId;
      }

      return await LabResult.findAll({ 
        where, 
        order: [['createdAt', 'DESC']],
        transaction: t
      });
    });

    res.json(labs);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.getAllLabs = async (req, res) => {
  try {
    const { organizationId, role } = req.user || {};
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const withTx = getTenantTransaction(req);

    const labs = await withTx(async (t) => {
      const options = {
        where: !isSuperAdmin && organizationId ? { organizationId } : {},
        order: [['createdAt', 'DESC']],
        include: [{
          model: Patient,
          as: 'Patient',
          include: [{
            model: User,
            where: isSuperAdmin || !organizationId ? {} : { organizationId }
          }]
        }],
        transaction: t
      };

      return await LabResult.findAll(options);
    });

    res.json(labs);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

/**
 * Express Lab Order Creation: Generates medical order and assigns sample barcode
 */
exports.createExpressOrder = async (req, res) => {
  try {
    const { patientId, testName, referenceRange, price } = req.body;
    if (!patientId || !testName) {
      return res.status(400).json({ message: 'El ID del paciente y el nombre de la prueba son obligatorios' });
    }

    const { organizationId, role } = req.user || {};
    const withTx = getTenantTransaction(req);

    const year = new Date().getFullYear();
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const sampleBarcode = `LAB-${year}-${randomCode}`;

    const labOrder = await withTx(async (t) => {
      const hasAccess = await validatePatientAccess(patientId, organizationId, role, t);
      if (!hasAccess) {
        const err = new Error('No tienes acceso a este paciente');
        err.status = 403;
        throw err;
      }

      return await LabResult.create({
        patientId,
        organizationId: organizationId || req.body.organizationId || null,
        testName,
        referenceRange: referenceRange || 'Normal',
        price: price ? parseFloat(price) : 0.00,
        status: 'Pending',
        sampleStatus: 'ORDERED',
        sampleBarcode
      }, { transaction: t });
    });

    res.status(201).json({
      message: '✅ Orden de laboratorio express creada exitosamente',
      sampleBarcode,
      labOrder
    });
  } catch (error) {
    console.error('Error in createExpressOrder:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
};

/**
 * Update Lab Sample Traceability Status: Transitions sample status (ORDERED -> SAMPLE_COLLECTED -> IN_PROCESSING -> COMPLETED)
 */
exports.updateSampleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleStatus, resultValue, fileUrl } = req.body;

    const validStatuses = ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROCESSING', 'COMPLETED', 'REJECTED'];
    if (!sampleStatus || !validStatuses.includes(sampleStatus)) {
      return res.status(400).json({ message: `Estado de muestra inválido. Valores permitidos: ${validStatuses.join(', ')}` });
    }

    const { organizationId, role } = req.user || {};
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const withTx = getTenantTransaction(req);

    const labOrder = await withTx(async (t) => {
      const order = await LabResult.findByPk(id, { transaction: t });
      if (!order) {
        const err = new Error('Orden de laboratorio no encontrada');
        err.status = 404;
        throw err;
      }

      if (!isSuperAdmin && organizationId && order.organizationId && order.organizationId !== organizationId) {
        const err = new Error('Orden de laboratorio no encontrada');
        err.status = 404;
        throw err;
      }

      const updateData = { sampleStatus };

      if (sampleStatus === 'SAMPLE_COLLECTED' && !order.collectionDate) {
        updateData.collectionDate = new Date();
      }

      if (sampleStatus === 'COMPLETED') {
        updateData.status = 'Completed';
        if (resultValue) updateData.resultValue = resultValue;
        if (fileUrl) updateData.fileUrl = fileUrl;
      }

      await order.update(updateData, { transaction: t });
      return order;
    });

    res.json({
      message: `✅ Estado de muestra actualizado a ${sampleStatus}`,
      labOrder
    });
  } catch (error) {
    console.error('Error in updateSampleStatus:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
};
