const { Appointment, Patient, Doctor, Payment, User, Specialty, Organization } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/db.config');

const getOrganizationFilter = (user) => {
  const { organizationId, role } = user;
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
  
  if (isSuperAdmin || !organizationId) {
    return {};
  }
  
  return { organizationId };
};

exports.getStats = async (req, res) => {
  const { role, id: userId, organizationId } = req.user;
  const userRole = role ? role.toUpperCase() : 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

  const responseData = {
    appointmentsToday: 0,
    totalPatients: 0,
    monthlyIncome: 0,
    pendingAppointments: 0,
    upcomingAppointments: [],
    activityData: [],
    inPersonCount: 0,
    videoCount: 0,
    specialtyStats: [],
    incomeDetails: {
      day: { USD: 0, Bs: 0 },
      week: { USD: 0, Bs: 0 },
      month: { USD: 0, Bs: 0 }
    }
  };

  try {
    const now = new Date();
    
    // Time Ranges
    const todayStart = new Date(now);
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23,59,59,999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0,0,0,0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0,0,0,0);

    // --- BASIC FILTERS ---
    let patientId = null;
    let doctorWhereClause = {};

    // Get organization filter
    const orgFilter = getOrganizationFilter(req.user);

    if (userRole === 'PATIENT') {
      const patient = await Patient.findOne({ where: { userId, ...orgFilter } });
      if (patient) patientId = patient.id;
    } else if (userRole === 'DOCTOR' && !isSuperAdmin) {
      const doctor = await Doctor.findOne({ where: { userId, ...orgFilter } });
      if (doctor) doctorWhereClause = { doctorId: doctor.id };
    }

    // 1. Basic Counts
    const baseWhere = patientId ? { patientId } : doctorWhereClause;
    
    // Filter appointments by organization for admin roles
    if (!isSuperAdmin && organizationId) {
      baseWhere.doctorId = {
        [Op.in]: sequelize.literal(`(SELECT id FROM "Doctors" WHERE "userId" IN (SELECT id FROM "Users" WHERE "organizationId" = '${organizationId}'))`)
      };
    }

    responseData.appointmentsToday = await Appointment.count({ 
      where: { ...baseWhere, date: { [Op.between]: [todayStart, todayEnd] } } 
    });
    responseData.pendingAppointments = await Appointment.count({ 
      where: { ...baseWhere, status: 'Pending' } 
    });

    if (['SUPER_ADMIN', 'SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(userRole)) {
      const patientWhere = isSuperAdmin ? {} : orgFilter;
      responseData.totalPatients = await Patient.count({ include: [{ model: User, where: patientWhere, attributes: [] }] });
    }

    // 2. Specialty Breakdown
    const specialtyWhere = isSuperAdmin ? {} : orgFilter;
    const specialties = await Specialty.findAll({
        where: specialtyWhere,
        include: [{
            model: Doctor,
            required: false,
            where: isSuperAdmin ? {} : orgFilter,
            include: [{
                model: Appointment,
                where: patientId ? { patientId } : doctorWhereClause,
                required: false
            }]
        }]
    });

    responseData.specialtyStats = (specialties || []).map(s => {
        let pending = 0;
        let completed = 0;
        (s.Doctors || []).forEach(d => {
            (d.Appointments || []).forEach(a => {
                if (a.status === 'Completed') completed++;
                else if (['Pending', 'Confirmed'].includes(a.status)) pending++;
            });
        });
        return { name: s.name, pending, completed };
    });

    // 3. Appointments for upcoming list
    const upcomingWhere = { 
      ...baseWhere,
      date: { [Op.gte]: now },
      status: { [Op.in]: ['Pending', 'Confirmed'] }
    };
    
    const upcomingAppointments = await Appointment.findAll({
      where: upcomingWhere,
      limit: 5,
      order: [['date', 'ASC']],
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User, Specialty] }
      ]
    });
    
    responseData.upcomingAppointments = upcomingAppointments.map(apt => {
      const a = apt.toJSON();
      
      return {
        id: a.id,
        date: a.date,
        // Format time as HH:MM for the frontend's formatTime function
        time: a.date ? 
                 new Date(a.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 
                 '00:00',
        patient: {
          name: a.Patient && a.Patient.User ? 
                `${a.Patient.User.firstName} ${a.Patient.User.lastName}` : 
                'Paciente'
        },
        doctor: {
          name: a.Doctor && a.Doctor.User ? 
                `${a.Doctor.User.firstName} ${a.Doctor.User.lastName}` : 
                'Doctor',
          specialty: a.Doctor && a.Doctor.Specialty ? 
                     a.Doctor.Specialty.name : 
                     'Medicina General'
        }
      };
    });

    // 4. Income Stats (only for authorized roles)
    if (['SUPER_ADMIN', 'SUPERADMIN', 'ADMINISTRATIVE'].includes(userRole)) {
      const paymentWhere = isSuperAdmin ? {} : { organizationId };
      
      const dayPayments = await Payment.findAll({ 
        where: { ...paymentWhere, status: 'Paid', createdAt: { [Op.between]: [todayStart, todayEnd] } } 
      });
      const weekPayments = await Payment.findAll({ 
        where: { ...paymentWhere, status: 'Paid', createdAt: { [Op.between]: [weekStart, now] } } 
      });
      const monthPayments = await Payment.findAll({ 
        where: { ...paymentWhere, status: 'Paid', createdAt: { [Op.between]: [monthStart, now] } } 
      });

      const sumAmounts = (payments) => payments.reduce((acc, p) => {
        acc.USD += parseFloat(p.amount) || 0;
        acc.Bs += parseFloat(p.amountBs) || 0;
        return acc;
      }, { USD: 0, Bs: 0 });

      responseData.incomeDetails = {
        day: sumAmounts(dayPayments),
        week: sumAmounts(weekPayments),
        month: sumAmounts(monthPayments)
      };
      responseData.monthlyIncome = responseData.incomeDetails.month.USD;
    }

    // 5. Appointment Type Counts
    if (['SUPER_ADMIN', 'SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(userRole)) {
      const typeWhere = isSuperAdmin ? {} : { ...baseWhere };
      responseData.inPersonCount = await Appointment.count({ where: { ...typeWhere, type: 'In-Person' } });
      responseData.videoCount = await Appointment.count({ where: { ...typeWhere, type: 'Video' } });
    }

    // 6. Activity Data (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
      
      const actWhere = isSuperAdmin ? {} : { ...baseWhere };
      const count = await Appointment.count({ 
        where: { ...actWhere, date: { [Op.between]: [dayStart, dayEnd] } } 
      });
      
      last7Days.push({ 
        date: d.toISOString().split('T')[0], 
        count 
      });
    }
    responseData.activityData = last7Days;

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
};
