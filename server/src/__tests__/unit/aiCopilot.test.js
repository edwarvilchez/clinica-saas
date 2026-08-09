const aiCopilot = require('../../utils/aiCopilot.service');

describe('AI Copilot Clinical Assistance Service', () => {
  test('Sugerencia de códigos CIE-11 basados en síntomas clínicos', async () => {
    const suggestions = await aiCopilot.suggestCIE11Codes(
      'Paciente refiere dolor de cabeza punzante, fotofobia intensa y náuseas',
      'Sospecha de migraña'
    );

    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].code).toBe('8A80.0'); // Migraña sin aura
    expect(suggestions[0].title).toContain('Migraña');
  });

  test('Generación de resumen clínico sintético de historial del paciente', async () => {
    const mockRecords = [
      {
        createdAt: new Date('2026-08-01T10:00:00Z'),
        symptoms: 'Cefalea intensa',
        diagnosis: 'Migraña sin aura',
        prescriptions: [{ drugName: 'Ibuprofeno 600mg' }]
      },
      {
        createdAt: new Date('2026-07-15T10:00:00Z'),
        symptoms: 'Fiebre y tos',
        diagnosis: 'Bronquitis aguda',
        prescriptions: [{ drugName: 'Amoxicilina 500mg' }]
      }
    ];

    const summary = await aiCopilot.generatePatientSummary('María Rodríguez', mockRecords);

    expect(summary).toHaveProperty('patientName', 'María Rodríguez');
    expect(summary).toHaveProperty('totalVisits', 2);
    expect(summary.keyDiagnoses).toContain('Migraña sin aura');
    expect(summary.prescribedDrugs).toContain('Ibuprofeno 600mg');
    expect(summary.summaryText).toContain('María Rodríguez');
  });
});
