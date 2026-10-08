const { 
  Appointment, 
  Patient, 
  Doctor, 
  Payment, 
  User, 
  Specialty, 
  Organization,
  Admission,
  HospitalBed
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/db.config');

const getOrganizationFilter = (user) => {
  const { organizationId, role } = user;
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';
  
  if (isSuperAdmin || !organizationId) {
    return {};
  }
  
  return { organizationId };
};

exports.getStats = async (req, res) => {
  const { role, id: userId, organizationId } = req.user;
  const userRole = role ? role.toUpperCase() : 'GUEST';
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';

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
    const todayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayEnd = new Date(now);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
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
      const orgDoctors = await Doctor.findAll({
        attributes: ['id'],
        include: [{
          model: User,
          where: { organizationId },
          attributes: []
        }]
      });
      const orgDoctorIds = orgDoctors.map(d => d.id);
      baseWhere.doctorId = { [Op.in]: orgDoctorIds.length > 0 ? orgDoctorIds : ['00000000-0000-0000-0000-000000000000'] };
    }

    responseData.appointmentsToday = await Appointment.count({ 
      where: { ...baseWhere, date: { [Op.between]: [todayStart, todayEnd] } } 
    });
    responseData.pendingAppointments = await Appointment.count({ 
      where: { ...baseWhere, status: 'Pending' } 
    });

    if (['SUPERADMIN', 'SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(userRole)) {
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
    if (['SUPERADMIN', 'SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'RECEPTIONIST'].includes(userRole)) {
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
    if (['SUPERADMIN', 'SUPERADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(userRole)) {
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

/**
 * 🏥 Fase 17: Operational Real-Time Clinic Dashboard
 * "¿Qué está pasando hoy en mi clínica?"
 * Provee métricas en tiempo real: citas del día, desglose por estado, teleconsultas,
 * ocupación hospitalaria/camas, ingresos recaudados en el turno y lista activa de pacientes.
 */
exports.getLiveOperationsDashboard = async (req, res) => {
  try {
    const { role, organizationId, id: userId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const effectiveOrgId = isSuperAdmin ? (req.query.organizationId || organizationId) : organizationId;

    const orgFilter = effectiveOrgId ? { organizationId: effectiveOrgId } : {};

    // 1. Rango del Día de Hoy (00:00:00 a 23:59:59.999 en hora local / servidor)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayDateFilter = {
      date: { [Op.between]: [startOfDay, endOfDay] }
    };

    // 2. Citas del Día (Métricas agregadas)
    const appointmentsToday = await Appointment.findAll({
      where: {
        ...orgFilter,
        ...todayDateFilter
      },
      include: [
        {
          model: Patient,
          attributes: ['id', 'medicalRecordNumber', 'documentId'],
          include: [{ model: User, attributes: ['firstName', 'lastName'] }]
        },
        {
          model: Doctor,
          attributes: ['id'],
          include: [
            { model: User, attributes: ['firstName', 'lastName'] },
            { model: Specialty, attributes: ['id', 'name'] }
          ]
        }
      ],
      order: [['date', 'ASC']]
    });

    const appointmentCounts = {
      total: appointmentsToday.length,
      confirmed: 0,
      pending: 0,
      completed: 0,
      cancelled: 0,
      inPerson: 0,
      video: 0
    };

    appointmentsToday.forEach(apt => {
      const status = apt.status;
      if (status === 'Confirmed') appointmentCounts.confirmed++;
      else if (status === 'Pending') appointmentCounts.pending++;
      else if (status === 'Completed') appointmentCounts.completed++;
      else if (status === 'Cancelled') appointmentCounts.cancelled++;

      if (apt.type === 'Video') appointmentCounts.video++;
      else appointmentCounts.inPerson++;
    });

    // 3. Ocupación Hospitalaria y Estado de Camas
    let hospitalStats = {
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
      maintenanceBeds: 0,
      occupancyRatePercent: 0,
      activeAdmissions: 0
    };

    try {
      const beds = await HospitalBed.findAll({ where: orgFilter });
      hospitalStats.totalBeds = beds.length;
      beds.forEach(b => {
        if (b.status === 'OCCUPIED') hospitalStats.occupiedBeds++;
        else if (b.status === 'AVAILABLE') hospitalStats.availableBeds++;
        else hospitalStats.maintenanceBeds++;
      });

      if (hospitalStats.totalBeds > 0) {
        hospitalStats.occupancyRatePercent = parseFloat(
          ((hospitalStats.occupiedBeds / hospitalStats.totalBeds) * 100).toFixed(1)
        );
      }

      hospitalStats.activeAdmissions = await Admission.count({
        where: {
          ...orgFilter,
          status: { [Op.notIn]: ['DISCHARGED', 'CLOSED', 'CANCELLED'] }
        }
      });
    } catch (e) {
      // Best-effort si el tenant no tiene módulo de hospitalización
    }

    // 4. Recaudación en Tiempo Real del Turno de Hoy
    const todayPayments = await Payment.findAll({
      where: {
        ...orgFilter,
        status: 'Paid',
        createdAt: { [Op.between]: [startOfDay, endOfDay] }
      },
      attributes: ['amount', 'amountBs', 'currency', 'method']
    });

    let shiftRevenueUSD = 0;
    let shiftRevenueVES = 0;
    const paymentMethodsSummary = {};

    todayPayments.forEach(p => {
      const amtUSD = parseFloat(p.amount) || 0;
      const amtBs = parseFloat(p.amountBs) || 0;
      shiftRevenueUSD += amtUSD;
      shiftRevenueVES += amtBs;

      const m = p.method || 'Other';
      paymentMethodsSummary[m] = (paymentMethodsSummary[m] || 0) + amtUSD;
    });

    // 5. Próximos Pacientes en Espera / En Curso (Live Queue)
    const activeQueue = appointmentsToday
      .filter(apt => ['Pending', 'Confirmed'].includes(apt.status))
      .slice(0, 10)
      .map(apt => ({
        id: apt.id,
        time: apt.date ? new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00',
        patientName: apt.Patient?.User ? `${apt.Patient.User.firstName} ${apt.Patient.User.lastName}`.trim() : 'Paciente',
        medicalRecordNumber: apt.Patient?.medicalRecordNumber || 'N/A',
        doctorName: apt.Doctor?.User ? `Dr. ${apt.Doctor.User.firstName} ${apt.Doctor.User.lastName}`.trim() : 'Médico',
        specialty: apt.Doctor?.Specialty?.name || 'General',
        type: apt.type,
        status: apt.status,
        reason: apt.reason || 'Consulta General'
      }));

    res.json({
      timestamp: now.toISOString(),
      organizationId: effectiveOrgId || null,
      summary: {
        appointments: appointmentCounts,
        hospital: hospitalStats,
        revenueToday: {
          totalUSD: shiftRevenueUSD.toFixed(2),
          totalVES: shiftRevenueVES.toFixed(2),
          paymentsCount: todayPayments.length,
          methods: paymentMethodsSummary
        }
      },
      activeQueue
    });
  } catch (error) {
    console.error('Error fetching live operations dashboard:', error);
    res.status(500).json({ error: error.message });
  }
};
