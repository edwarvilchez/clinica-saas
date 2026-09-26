const { LabResult, Patient, User } = require('../models');

const validatePatientAccess = async (patientId, organizationId, role) => {
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';
  if (isSuperAdmin) return true;

  const patient = await Patient.findByPk(patientId, { include: [User] });
  if (!patient) return false;
  
  return patient.User.organizationId === organizationId;
};

exports.createLabResult = async (req, res) => {
  try {
    const { organizationId, role, id: userId } = req.user;
    const { patientId } = req.body;

    const hasAccess = await validatePatientAccess(patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    const result = await LabResult.create(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientLabs = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { patientId } = req.params;

    const hasAccess = await validatePatientAccess(patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    const labs = await LabResult.findAll({ 
      where: { patientId }, 
      order: [['createdAt', 'DESC']] 
    });
    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllLabs = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';

    const options = {
      order: [['createdAt', 'DESC']],
      include: [{
        model: Patient,
        as: 'Patient',
        include: [{
          model: User,
          where: isSuperAdmin ? {} : { organizationId }
        }]
      }]
    };

    const labs = await LabResult.findAll(options);
    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    const year = new Date().getFullYear();
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const sampleBarcode = `LAB-${year}-${randomCode}`;

    const labOrder = await LabResult.create({
      patientId,
      testName,
      referenceRange: referenceRange || 'Normal',
      price: price ? parseFloat(price) : 0.00,
      status: 'Pending',
      sampleStatus: 'ORDERED',
      sampleBarcode
    });

    res.status(201).json({
      message: '✅ Orden de laboratorio express creada exitosamente',
      sampleBarcode,
      labOrder
    });
  } catch (error) {
    console.error('Error in createExpressOrder:', error);
    res.status(500).json({ error: error.message });
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

    const labOrder = await LabResult.findByPk(id);
    if (!labOrder) return res.status(404).json({ message: 'Orden de laboratorio no encontrada' });

    const updateData = { sampleStatus };

    if (sampleStatus === 'SAMPLE_COLLECTED' && !labOrder.collectionDate) {
      updateData.collectionDate = new Date();
    }

    if (sampleStatus === 'COMPLETED') {
      updateData.status = 'Completed';
      if (resultValue) updateData.resultValue = resultValue;
      if (fileUrl) updateData.fileUrl = fileUrl;
    }

    await labOrder.update(updateData);

    res.json({
      message: `✅ Estado de muestra actualizado a ${sampleStatus}`,
      labOrder
    });
  } catch (error) {
    console.error('Error in updateSampleStatus:', error);
    res.status(500).json({ error: error.message });
  }
};
