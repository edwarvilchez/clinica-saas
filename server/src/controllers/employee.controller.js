const { Employee, Doctor, Specialty, Department, User, Role, sequelize } = require('../models');

const getOrgId = (req) => req.user?.organizationId || req.organizationId || null;
const isPlatformAdmin = (req) => req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';

exports.getEmployees = async (req, res) => {
  try {
    const { isDoctor, departmentId, status } = req.query;
    const where = {};
    if (isDoctor !== undefined) where.isDoctor = isDoctor === 'true';
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId) where.organizationId = orgId;

    const employees = await Employee.findAll({
      where,
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Specialty, attributes: ['id', 'name'] },
        { 
          model: Doctor, 
          attributes: ['id', 'licenseNumber'],
          include: [{ model: User, attributes: ['id', 'email', 'isActive'] }]
        }
      ],
      order: [['firstName', 'ASC']]
    });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const orgId = getOrgId(req);
    const {
      employeeCode,
      documentId,
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
      departmentId,
      isDoctor = false,
      specialtyId,
      medicalLicense,
      contractType,
      baseSalaryUSD,
      hireDate,
      address,
      emergencyContactName,
      emergencyContactPhone
    } = req.body;

    if (!documentId || !firstName || !lastName || !jobTitle) {
      await t.rollback();
      return res.status(400).json({ message: 'Cédula, nombre, apellido y cargo son obligatorios' });
    }

    const cleanDoc = documentId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existingEmp = await Employee.findOne({ where: { documentId: cleanDoc } });
    if (existingEmp) {
      await t.rollback();
      return res.status(409).json({ message: `⚠️ Ya existe un empleado registrado con el documento ${documentId}. Se evitan registros duplicados.` });
    }

    const code = employeeCode || `EMP-${Date.now().toString().substring(7)}`;
    const existingCode = await Employee.findOne({ where: { employeeCode: code } });
    if (existingCode) {
      await t.rollback();
      return res.status(409).json({ message: `⚠️ Ya existe un empleado registrado con el código ${code}.` });
    }

    let doctorId = null;
    let userId = null;

    // Sincronización automática si es Médico
    if (isDoctor) {
      const doctorRole = await Role.findOne({ where: { name: 'DOCTOR' } });
      const roleId = doctorRole ? doctorRole.id : null;

      const userEmail = email || `${documentId.toLowerCase().replace(/[^a-z0-9]/g, '')}@clinicasaas.com`;
      const [user] = await User.findOrCreate({
        where: { email: userEmail },
        defaults: {
          username: `dr.${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
          email: userEmail,
          password: process.env.TEST_PASSWORD || 'ClinicaSaaS123',
          firstName,
          lastName,
          roleId,
          organizationId: orgId,
          isActive: true,
          mustChangePassword: false
        },
        transaction: t
      });

      userId = user.id;

      const [doctor] = await Doctor.findOrCreate({
        where: { userId: user.id },
        defaults: {
          userId: user.id,
          organizationId: orgId,
          licenseNumber: medicalLicense || documentId,
          specialtyId: specialtyId || null,
          phone: phone || null,
          address: address || null
        },
        transaction: t
      });

      doctorId = doctor.id;
    }

    const employee = await Employee.create({
      organizationId: orgId,
      userId,
      doctorId,
      employeeCode: code,
      documentId,
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
      departmentId: departmentId || null,
      isDoctor: !!isDoctor,
      specialtyId: specialtyId || null,
      medicalLicense: medicalLicense || null,
      contractType: contractType || 'FULL_TIME',
      baseSalaryUSD: baseSalaryUSD || 0.00,
      hireDate: hireDate || new Date(),
      address,
      emergencyContactName,
      emergencyContactPhone,
      status: 'ACTIVE'
    }, { transaction: t });

    await t.commit();

    const populated = await Employee.findByPk(employee.id, {
      include: [
        { model: Department },
        { model: Specialty },
        { model: Doctor, include: [{ model: User }] }
      ]
    });

    res.status(201).json(populated);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ message: 'Empleado no encontrado' });
    }

    const orgId = getOrgId(req);
    const isSuperAdmin = isPlatformAdmin(req);
    if (!isSuperAdmin && orgId && employee.organizationId && employee.organizationId !== orgId) {
      return res.status(403).json({ message: 'No tienes permisos para modificar este empleado de otra clínica' });
    }

    await employee.update(req.body);

    const updated = await Employee.findByPk(id, {
      include: [{ model: Department }, { model: Specialty }, { model: Doctor }]
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
