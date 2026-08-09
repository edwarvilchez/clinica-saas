/**
 * WhatsApp Service (Simulation)
 * In a real environment, you would use Twilio, UltraMsg, or a similar provider.
 */
class WhatsAppService {
  
  _generateGoogleCalendarLink(title, dateStr, durationMinutes = 30, details = '') {
    const startDate = new Date(dateStr);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    };

    const start = formatDate(startDate);
    const end = formatDate(endDate);

    const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams({
      text: title,
      dates: `${start}/${end}`,
      details: details,
      location: 'Clínica Clinica SaaS'
    });

    return `${baseUrl}&${params.toString()}`;
  }

  async sendAppointmentConfirmation(patientPhone, appointmentDetails) {
    const { patientName, date, time, doctorName, appointmentId } = appointmentDetails;
    
    // Construct a full Date object for the calendar link
    // Assuming 'date' and 'time' strings allow us to construct a valid date, or we use a raw Date object passed in 'dateObj'
    // For simplicity, let's assume 'appointmentDetails.rawDate' is the JS Date object
    const rawDate = appointmentDetails.rawDate || new Date(); 

    const calendarLink = this._generateGoogleCalendarLink(
      `Cita Médica - Dr. ${doctorName}`,
      rawDate,
      30,
      `Cita con Dr. ${doctorName}. Paciente: ${patientName}. Para reagendar o cancelar, contacte a la clínica.`
    );

    const message = `✅ *Cita Confirmada*

Hola ${patientName}, tu cita ha sido agendada con éxito:

📅 *Fecha:* ${date}
⏰ *Hora:* ${time}
👨‍⚕️ *Doctor:* ${doctorName}
🏥 *Clínica Clinica SaaS*

📅 *Añadir a tu calendario:*
${calendarLink}

Si deseas cancelar o reagendar, por favor utiliza el siguiente enlace:
https://clinicasaas.app/citas/gestion/${appointmentId}

¡Te esperamos!`;

    this._simulateSend(patientPhone, message);
    return { success: true, messageId: 'conf-' + Date.now() };
  }

  async sendAppointmentReminder(patientPhone, appointmentDetails) {
    const { patientName, time, doctorName, appointmentId } = appointmentDetails;
    const clientUrl = process.env.CLIENT_URL || 'https://clinicasaas.app';
    
    const message = `🔔 *Recordatorio de Cita*

Hola ${patientName}, te recordamos que tienes una cita en 15 minutos:

⏰ *Hora:* ${time}
👨‍⚕️ *Doctor:* ${doctorName}

Si no puedes asistir, por favor notifícanos inmediatamente:
${clientUrl}/appointments`;

    return await this._sendMessage(patientPhone, message);
  }

  async send24hAppointmentReminder(patientPhone, appointmentDetails) {
    const { patientName, date, time, doctorName, appointmentId, rawDate, specialtyName } = appointmentDetails;
    const clientUrl = process.env.CLIENT_URL || 'https://clinicasaas.app';

    const calendarLink = this._generateGoogleCalendarLink(
      `Cita Médica - Dr. ${doctorName}`,
      rawDate || new Date(),
      30,
      `Cita médica de ${specialtyName || 'Medicina General'} con Dr. ${doctorName}. Paciente: ${patientName}.`
    );

    const message = `⏰ *Recordatorio de Cita Médica (Mañana)*

Hola ${patientName}, te recordamos que tienes una cita agendada para mañana:

📅 *Fecha:* ${date}
⏰ *Hora:* ${time}
👨‍⚕️ *Doctor:* ${doctorName} ${specialtyName ? `(${specialtyName})` : ''}
🏥 *MedicalCare 888*

📅 *Añadir a Google Calendar:*
${calendarLink}

🔗 *Gestionar o confirmar tu cita:*
${clientUrl}/appointments

¡Te esperamos puntualmente!`;

    return await this._sendMessage(patientPhone, message);
  }

  async sendCancellationNotice(patientPhone, { patientName, date, time }) {
    const message = `❌ *Cita Cancelada*

Hola ${patientName}, tu cita del ${date} a las ${time} ha sido cancelada.`;

    return await this._sendMessage(patientPhone, message);
  }

  async _sendMessage(to, body) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = process.env;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
      try {
        const axios = require('axios');
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
        const formattedFrom = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') ? TWILIO_WHATSAPP_NUMBER : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
        
        const params = new URLSearchParams();
        params.append('From', formattedFrom);
        params.append('To', formattedTo);
        params.append('Body', body);

        const response = await axios.post(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          params,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        return { success: true, messageId: response.data.sid, provider: 'twilio' };
      } catch (err) {
        console.error('❌ Error enviando WhatsApp vía Twilio:', err.response?.data || err.message);
        return { success: false, error: err.message };
      }
    }

    this._simulateSend(to, body);
    return { success: true, messageId: 'sim-' + Date.now(), provider: 'simulation' };
  }

  _simulateSend(to, body) {
    console.log('\n📱 --- WHATSAPP SIMULADO ---');
    console.log(`➡️ Para: ${to}`);
    console.log(`💬 Mensaje:\n${body}`);
    console.log('-----------------------------\n');
  }
}

module.exports = new WhatsAppService();
