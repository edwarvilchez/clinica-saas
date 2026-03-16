const cron = require('node-cron');
const { Appointment, Patient, Doctor, User, Organization } = require('../models');
const whatsapp = require('./whatsapp.service');
const sendEmail = require('./sendEmail');
const { Op } = require('sequelize');

const startScheduler = () => {
    console.log('⏰ Scheduler iniciado: Comprobando citas cada minuto...');
    
    // Check every minute
    cron.schedule('* * * * *', async () => {
        try {
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
                const patientPhone = appt.Patient.user ? appt.Patient.User.phone : appt.Patient.phone;
                const patientName = `${appt.Patient.User.firstName} ${appt.Patient.User.lastName}`;
                const doctorName = `${appt.Doctor.User.firstName} ${appt.Doctor.User.lastName}`;
                const apptTime = new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                 // Get phone from Patient -> User.phone or Patient.phone if stored there. 
                 // Based on User model, phone is on User.
                 
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

        } catch (error) {
            console.error('❌ Scheduler Error:', error);
        }
    });
    // Check subscriptions daily at 00:01
    cron.schedule('1 0 * * *', async () => {
        try {
            console.log('🔄 Watchdog: Verificando estados de suscripción...');
            const now = new Date();
            
            // 1. Mark expired trials as PAST_DUE
            const expiredOrgs = await Organization.findAll({
                where: {
                    subscriptionStatus: 'TRIAL',
                    trialEndsAt: { [Op.lt]: now }
                },
                include: [{ model: User, as: 'owner' }] 
            });

            for (const org of expiredOrgs) {
                console.log(`❌ TRIAL Expirado: ${org.name}. Cambiando a PAST_DUE.`);
                await org.update({ subscriptionStatus: 'PAST_DUE' });
                
                // Notify owner via email if available
                const owner = await User.findByPk(org.ownerId);
                if (owner && owner.email) {
                    await sendEmail({
                        email: owner.email,
                        subject: 'Tu periodo de prueba en Medicus ha finalizado',
                        message: `Hola ${owner.firstName},\n\nTe informamos que el periodo de prueba de 7 días para ${org.name} ha finalizado. Para seguir disfrutando de todas las funciones, por favor actualiza tu plan en la sección de suscripción.\n\nSaludos,\nEquipo Medicus.`
                    });
                }
            }

            // 2. Remind organizations with 2 days left
            const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            const warningOrgs = await Organization.findAll({
                where: {
                    subscriptionStatus: 'TRIAL',
                    trialEndsAt: {
                        [Op.between]: [new Date(twoDaysFromNow.setHours(0,0,0,0)), new Date(twoDaysFromNow.setHours(23,59,59,999))]
                    }
                }
            });

            for (const org of warningOrgs) {
                const owner = await User.findByPk(org.ownerId);
                if (owner && owner.email) {
                    await sendEmail({
                        email: owner.email,
                        subject: 'Recordatorio: Tu prueba de Medicus termina pronto',
                        message: `Hola ${owner.firstName},\n\nTe recordamos que a tu cuenta de ${org.name} le quedan solo 2 días de prueba gratuita. No pierdas el acceso a tus historias clínicas y agenda.\n\nActualiza aquí: ${process.env.CLIENT_URL || 'http://localhost:4200'}/subscription\n\nSaludos,\nEquipo Medicus.`
                    });
                }
            }

        } catch (error) {
            console.error('❌ Watchdog Error:', error);
        }
    });
};

module.exports = startScheduler;
