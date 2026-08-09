const { Patient, User, Doctor, Appointment } = require('../models');
const { sendAppointmentConfirmation } = require('../utils/whatsapp.service');

exports.createPublicAppointment = async (req, res) => {
  try {
    const { patientInfo, appointmentInfo } = req.body;
    
    // Check if patient exists by email or documentId
    let user = await User.findOne({ 
      where: { email: patientInfo.email } 
    });
    
    let patient;
    let accountExists = false;

    if (user) {
      // User exists, find their patient record
      patient = await Patient.findOne({ where: { userId: user.id } });
      accountExists = true;
      
      // Update patient info if needed
      if (patient) {
        await patient.update({
          phone: patientInfo.phone,
          documentId: patientInfo.documentId
        });
      }
    } else {
      // Check by documentId
      patient = await Patient.findOne({ 
        where: { documentId: patientInfo.documentId },
        include: [User]
      });
      
      if (patient) {
        // Patient exists, update info
        accountExists = true;
        await patient.update({ phone: patientInfo.phone });
        await patient.User.update({ email: patientInfo.email });
        user = patient.User;
      } else {
        // Create new user and patient (temporary/guest account)
        const username = `patient_${patientInfo.documentId.replace(/[^a-zA-Z0-9]/g, '')}`;
        const tempPassword = Math.random().toString(36).slice(-8);
        
        // Find PATIENT role
        const Role = require('../models').Role;
        const patientRole = await Role.findOne({ where: { name: 'PATIENT' } });
        
        user = await User.create({
          username,
          email: patientInfo.email,
          password: tempPassword,
          firstName: patientInfo.firstName,
          lastName: patientInfo.lastName,
          roleId: patientRole.id
        });

        patient = await Patient.create({
          userId: user.id,
          documentId: patientInfo.documentId,
          phone: patientInfo.phone
        });
      }
    }

    // Determine initial appointment status based on paymentInfo
    const { Payment } = require('../models');
    const paymentInfo = req.body.paymentInfo;
    const isOnlineInstant = paymentInfo && ['Card', 'Stripe', 'PayPal', 'Online'].includes(paymentInfo.method);
    const initialStatus = paymentInfo ? (isOnlineInstant ? 'Confirmed' : 'Pending') : 'Confirmed';

    // Create appointment
    const appointment = await Appointment.create({
      patientId: patient.id,
      doctorId: appointmentInfo.doctorId,
      date: appointmentInfo.date,
      reason: appointmentInfo.reason,
      notes: appointmentInfo.notes,
      status: initialStatus
    });

    // Create Payment record if paymentInfo is provided
    let paymentRecord = null;
    if (paymentInfo) {
      paymentRecord = await Payment.create({
        amount: paymentInfo.amount || 50.00,
        method: paymentInfo.method || 'Card',
        currency: paymentInfo.currency || 'USD',
        status: isOnlineInstant ? 'Paid' : 'Pending',
        reference: paymentInfo.reference || `PAY-${Date.now()}`,
        bank: paymentInfo.bank || 'Pasarela Online',
        concept: paymentInfo.concept || `Cita Médica - ${appointmentInfo.reason || 'Consulta'}`,
        paymentType: 'APPOINTMENT',
        patientId: patient.id,
        appointmentId: appointment.id,
        organizationId: user.organizationId || null
      });
    }

    // Fetch full appointment details for WhatsApp
    const appointmentDetails = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Patient, include: [User] },
        { model: Doctor, include: [User] }
      ]
    });

    // Send WhatsApp confirmation
    try {
      await sendAppointmentConfirmation(
        patient.phone,
        {
          patientName: `${patientInfo.firstName} ${patientInfo.lastName}`,
          date: new Date(appointmentInfo.date).toLocaleDateString('es-ES'),
          time: new Date(appointmentInfo.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          doctorName: appointmentDetails.Doctor.User.firstName + ' ' + appointmentDetails.Doctor.User.lastName,
          appointmentId: appointment.id,
          rawDate: new Date(appointmentInfo.date)
        }
      );
      console.log('✅ WhatsApp notification sent successfully');
    } catch (whatsappError) {
      console.error('❌ WhatsApp notification failed:', whatsappError.message);
      // Don't fail the appointment creation if WhatsApp fails
    }

    // Send Email confirmation
    try {
      const sendEmail = require('../utils/sendEmail');
      const doctorName = `${appointmentDetails.Doctor.User.firstName} ${appointmentDetails.Doctor.User.lastName}`;
      const appointmentDate = new Date(appointmentInfo.date);
      const formattedDate = appointmentDate.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = appointmentDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const paymentSummary = paymentRecord ? `
💳 INFORMACIÓN DE PAGO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Monto: ${paymentRecord.amount} ${paymentRecord.currency}
💳 Método: ${paymentRecord.method}
📌 Referencia: ${paymentRecord.reference}
Estatus de Pago: ${paymentRecord.status === 'Paid' ? 'Pagado (Confirmado)' : 'Pendiente de Verificación'}
` : '';

      const emailMessage = `Hola ${patientInfo.firstName},

Tu cita ha sido agendada exitosamente en Clínica Clinica SaaS.

📋 DETALLES DE LA CITA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👨‍⚕️ Doctor: Dr. ${doctorName}
📅 Fecha: ${formattedDate}
⏰ Hora: ${formattedTime}
📝 Motivo: ${appointmentInfo.reason}
🏥 Lugar: Clínica Clinica SaaS
${paymentSummary}
${appointmentInfo.notes ? `📌 Notas: ${appointmentInfo.notes}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANTE:
• Por favor llega 10 minutos antes de tu cita
• Trae tu documento de identidad
• Si necesitas cancelar o reagendar, contáctanos con al menos 24 horas de anticipación

También hemos enviado la confirmación a tu WhatsApp: ${patient.phone}

Saludos,
Equipo de Clínica Clinica SaaS`;

      await sendEmail({
        email: user.email,
        subject: `✅ Confirmación de Cita ${paymentRecord ? '(Con Pago Registrado)' : ''} - MedicalCare 888`,
        message: emailMessage
      });
      console.log('✅ Email confirmation sent successfully to:', user.email);
    } catch (emailError) {
      console.error('❌ Email notification failed:', emailError.message);
      // Don't fail the appointment creation if email fails
    }

    res.status(201).json({ 
      message: 'Appointment created successfully',
      appointmentId: appointment.id,
      payment: paymentRecord,
      accountExists
    });
  } catch (error) {
    console.error('Error creating public appointment:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPublicDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.findAll({ 
      include: [
        { 
          model: User,
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: require('../models').Specialty,
          attributes: ['name']
        }
      ]
    });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyPrescription = async (req, res) => {
  try {
    const { hash } = req.params;
    const { Prescription, MedicalRecord, Patient, User, Doctor, Specialty, Drug } = require('../models');

    const prescription = await Prescription.findOne({
      where: { verificationHash: hash },
      include: [
        { model: Drug, as: 'drug' },
        {
          model: MedicalRecord,
          include: [
            {
              model: Patient,
              include: [{ model: User, attributes: ['firstName', 'lastName'] }]
            },
            {
              model: Doctor,
              include: [
                { model: User, attributes: ['firstName', 'lastName', 'email'] },
                { model: Specialty, attributes: ['name'] }
              ]
            }
          ]
        }
      ]
    });

    if (!prescription) {
      return res.status(404).json({
        valid: false,
        message: 'Receta médica no encontrada o el código de verificación es inválido.'
      });
    }

    const patientUser = prescription.MedicalRecord?.Patient?.User;
    const patientName = patientUser ? `${patientUser.firstName} ${patientUser.lastName}` : 'Paciente';

    const doctorUser = prescription.MedicalRecord?.Doctor?.User;
    const doctorName = doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}` : 'Médico Asignado';
    const specialtyName = prescription.MedicalRecord?.Doctor?.Specialty?.name || 'Medicina General';
    const doctorLicense = prescription.MedicalRecord?.Doctor?.medicalLicense || 'MP-REG-888';

    res.json({
      valid: true,
      status: prescription.status === 'active' ? 'VÁLIDA' : prescription.status.toUpperCase(),
      prescriptionId: prescription.id,
      verificationHash: prescription.verificationHash,
      digitalSignature: prescription.digitalSignature,
      issuedAt: prescription.createdAt,
      doctor: {
        name: `Dr. ${doctorName}`,
        specialty: specialtyName,
        medicalLicense: doctorLicense
      },
      patient: {
        name: patientName
      },
      medication: {
        drugName: prescription.drugName,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        duration: prescription.duration,
        instructions: prescription.instructions
      }
    });
  } catch (error) {
    console.error('Error verificando prescripción:', error);
    res.status(500).json({ valid: false, error: 'Error interno al verificar la receta.' });
  }
};

exports.getCheckoutPreview = async (req, res) => {
  try {
    const { doctorId } = req.body;
    const { Doctor, User, Specialty } = require('../models');

    let baseFee = 50.00;
    let doctorName = 'Médico de Turno';
    let specialtyName = 'Medicina General';

    if (doctorId) {
      const doctor = await Doctor.findByPk(doctorId, {
        include: [{ model: User }, { model: Specialty }]
      });
      if (doctor) {
        doctorName = `Dr. ${doctor.User.firstName} ${doctor.User.lastName}`;
        if (doctor.Specialty) specialtyName = doctor.Specialty.name;
        if (doctor.consultationFee) baseFee = parseFloat(doctor.consultationFee);
      }
    }

    const taxes = Math.round(baseFee * 0.16 * 100) / 100;
    const total = Math.round((baseFee + taxes) * 100) / 100;

    res.json({
      doctorName,
      specialtyName,
      currency: 'USD',
      breakdown: {
        subtotal: baseFee,
        taxes: taxes,
        total: total
      },
      availableMethods: ['Card', 'Stripe', 'PayPal', 'PagoMovil', 'Transfer']
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
