const whatsapp = require('../../utils/whatsapp.service');

describe('WhatsApp Notification Service - 24h Reminder', () => {
  test('send24hAppointmentReminder genera el mensaje simulado correctamente', async () => {
    const details = {
      patientName: 'Juan Pérez',
      date: 'Lunes, 10 de Agosto de 2026',
      time: '10:00 AM',
      doctorName: 'Carlos Mendoza',
      appointmentId: 'test-123',
      rawDate: new Date('2026-08-10T10:00:00Z'),
      specialtyName: 'Cardiología'
    };

    const result = await whatsapp.send24hAppointmentReminder('+584121234567', details);

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('provider', 'simulation');
    expect(result).toHaveProperty('messageId');
    expect(result.messageId).toMatch(/^sim-/);
  });

  test('_generateGoogleCalendarLink crea un link válido para Google Calendar', () => {
    const link = whatsapp._generateGoogleCalendarLink(
      'Cita Médica - Dr. Test',
      new Date('2026-08-10T10:00:00Z'),
      30,
      'Detalles de la cita'
    );

    expect(link).toContain('https://www.google.com/calendar/render?action=TEMPLATE');
    expect(link).toContain('text=Cita+M%C3%A9dica+-+Dr.+Test');
  });
});
