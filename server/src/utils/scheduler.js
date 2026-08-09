const cron = require('node-cron');
const { Appointment, Patient, Doctor, User, Organization } = require('../models');
const whatsapp = require('./whatsapp.service');
const sendEmail = require('./sendEmail');
const {
    getSubscriptionExpiryReminderEmail,
    getSubscriptionExpiredEmail
} = require('./emailTemplates');
const { Op } = require('sequelize');

const runSubscriptionWatchdog = async () => {
    console.log('🔄 Watchdog: Verificando estados de suscripción...');
    const now = new Date();
    const subscriptionUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/subscription`;
    const reminderDays = [7, 5, 3, 1];

    // 1. Mark expired subscriptions as PAST_DUE
    const expiredOrgs = await Organization.findAll({
        where: {
            subscriptionStatus: {
                [Op.in]: ['TRIAL', 'ACTIVE']
            },
            trialEndsAt: { [Op.lt]: now }
        },
        include: [{ model: User, as: 'owner' }]
    });

    for (const org of expiredOrgs) {
        console.log(`❌ Suscripción expirada: ${org.name}. Cambiando a PAST_DUE.`);
        await org.update({ subscriptionStatus: 'PAST_DUE' });

        const owner = org.owner || await User.findByPk(org.ownerId);
        if (owner && owner.email) {
            await sendEmail({
                email: owner.email,
                subject: 'Tu suscripción en Clinica SaaS ha vencido',
                message: `Hola ${owner.firstName},\n\nTe informamos que la suscripción de ${org.name} ha vencido y tu cuenta está en estado pendiente de pago.\n\nRenueva aquí: ${subscriptionUrl}\n\nSaludos,\nEquipo Clinica SaaS.`,
                html: getSubscriptionExpiredEmail({
                    nombre: owner.firstName,
                    organizationName: org.name,
                    subscriptionUrl
                })
            });
        }
    }

    // 2. Send reminders at 7, 5, 3 and 1 days before expiration
    for (const daysLeft of reminderDays) {
        const targetStart = new Date(now);
        targetStart.setDate(targetStart.getDate() + daysLeft);
        targetStart.setHours(0, 0, 0, 0);

        const targetEnd = new Date(now);
        targetEnd.setDate(targetEnd.getDate() + daysLeft);
        targetEnd.setHours(23, 59, 59, 999);

        const warningOrgs = await Organization.findAll({
            where: {
                subscriptionStatus: {
                    [Op.in]: ['TRIAL', 'ACTIVE']
                },
                trialEndsAt: {
                    [Op.between]: [targetStart, targetEnd]
                }
            },
            include: [{ model: User, as: 'owner' }]
        });

        for (const org of warningOrgs) {
            const owner = org.owner || await User.findByPk(org.ownerId);
            if (owner && owner.email) {
                const expiresAt = new Date(org.trialEndsAt).toLocaleDateString('es-ES');
                const daysLabel = daysLeft === 1 ? '1 día' : `${daysLeft} días`;

                await sendEmail({
                    email: owner.email,
                    subject: `Recordatorio: tu suscripción vence en ${daysLabel}`,
                    message: `Hola ${owner.firstName},\n\nTe recordamos que la suscripción de ${org.name} vence en ${daysLabel} (fecha de vencimiento: ${expiresAt}).\n\nRenueva aquí: ${subscriptionUrl}\n\nSaludos,\nEquipo Clinica SaaS.`,
                    html: getSubscriptionExpiryReminderEmail({
                        nombre: owner.firstName,
                        organizationName: org.name,
                        daysLeft,
                        expiresAt,
                        subscriptionUrl
                    })
                });
            }
        }
    }
};

const check24hAppointmentReminders = async () => {
    try {
        const now = new Date();
        const start24h = new Date(now.getTime() + (23.5 * 3600000));
        const end24h = new Date(now.getTime() + (24.5 * 3600000));

        const appointments = await Appointment.findAll({
            where: {
                date: {
                    [Op.between]: [start24h, end24h]
                },
                status: 'Confirmed',
                reminder24hSent: false
            },
            include: [
                { model: Patient, include: [User] },
                { model: Doctor, include: [User] }
            ]
        });

        if (appointments.length > 0) {
            console.log(`📱 [Scheduler 24h] Encontradas ${appointments.length} citas para recordatorio de 24 horas.`);
        }

        for (const appt of appointments) {
            const patientUser = appt.Patient?.User || {};
            const doctorUser = appt.Doctor?.User || {};
            const patientPhone = patientUser.phone || appt.Patient?.phone;
            const patientEmail = patientUser.email || appt.Patient?.email;
            const patientName = `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Paciente';
            const doctorName = `${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() || 'Médico';
            const apptDate = new Date(appt.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const apptTime = new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let sendSuccess = false;

            if (patientPhone) {
                const res = await whatsapp.send24hAppointmentReminder(patientPhone, {
                    patientName,
                    date: apptDate,
                    time: apptTime,
                    doctorName,
                    appointmentId: appt.id,
                    rawDate: appt.date
                });
                if (res && res.success) sendSuccess = true;
            }

            // Fallback a Email si falla WhatsApp o no hay número telefónico
            if (!sendSuccess && patientEmail) {
                console.log(`📧 [Fallback] Enviando recordatorio 24h por Email a ${patientEmail}`);
                await sendEmail({
                    email: patientEmail,
                    subject: `Recordatorio de Cita Médica para Mañana - MedicalCare 888`,
                    message: `Hola ${patientName},\n\nTe recordamos que tienes una cita médica programada para mañana (${apptDate} a las ${apptTime}) con el Dr. ${doctorName}.\n\nPor favor asiste puntualmente.`
                });
                sendSuccess = true;
            }

            if (sendSuccess) {
                appt.reminder24hSent = true;
                await appt.save();
            }
        }
    } catch (error) {
        console.error('❌ Scheduler 24h Error:', error);
    }
};

const startScheduler = () => {
    console.log('⏰ Scheduler iniciado: Comprobando citas cada minuto...');
    
    // Check every minute (15min and 24h reminders)
    cron.schedule('* * * * *', async () => {
        try {
            // Recordatorio de 15-20 minutos
            const now = new Date();
            const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);
            const twentyMinutesLater = new Date(now.getTime() + 20 * 60000); // Window of 5 mins

            // Find appointments happening in 15-20 mins that haven't been reminded
            const appointments = await Appointment.findAll({
                where: {
                    date: {
                        [Op.between]: [fifteenMinutesLater, twentyMinutesLater]
                    },
                    status: 'Confirmed',
                    reminderSent: false
                },
                include: [
                    { model: Patient, include: [User] },
                    { model: Doctor, include: [User] }
                ]
            });

            if (appointments.length > 0) {
                console.log(`🔎 Encontradas ${appointments.length} citas para recordar.`);
            }

            for (const appt of appointments) {
                const patientPhone = appt.Patient.User ? appt.Patient.User.phone : appt.Patient.phone;
                const patientName = `${appt.Patient.User.firstName} ${appt.Patient.User.lastName}`;
                const doctorName = `${appt.Doctor.User.firstName} ${appt.Doctor.User.lastName}`;
                const apptTime = new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                if (patientPhone) {
                    await whatsapp.sendAppointmentReminder(patientPhone, {
                        patientName,
                        time: apptTime,
                        doctorName,
                        appointmentId: appt.id
                    });

                    // Mark as sent
                    appt.reminderSent = true;
                    await appt.save();
                }
            }

            // Recordatorio 24 horas antes
            await check24hAppointmentReminders();

        } catch (error) {
            console.error('❌ Scheduler Error:', error);
        }
    });

    // Check subscriptions daily at 00:01
    cron.schedule('1 0 * * *', async () => {
        try {
            await runSubscriptionWatchdog();

        } catch (error) {
            console.error('❌ Watchdog Error:', error);
        }
    });
};

module.exports = startScheduler;
module.exports.runSubscriptionWatchdog = runSubscriptionWatchdog;
module.exports.check24hAppointmentReminders = check24hAppointmentReminders;
