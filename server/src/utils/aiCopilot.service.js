const CIE11_DICTIONARY = [
  { code: '8A80.0', title: 'Migraña sin aura', keywords: ['migraña', 'cefalea', 'dolor de cabeza', 'fotofobia', 'náuseas'] },
  { code: '1B10.0', title: 'Tuberculosis pulmonar', keywords: ['tos', 'expectoración', 'fiebre', 'pérdida de peso', 'hemoptisis'] },
  { code: 'BA00.0', title: 'Hipertensión esencial', keywords: ['presión alta', 'hipertensión', 'cefalea occipital', 'mareo'] },
  { code: '5A11', title: 'Diabetes mellitus tipo 2', keywords: ['polidipsia', 'poliuria', 'glucosa alta', 'diabetes', 'polifagia'] },
  { code: 'CA23', title: 'Asma bronquial', keywords: ['disnea', 'sibilancias', 'asma', 'opresión torácica', 'tos nocturna'] },
  { code: 'DA01.0', title: 'Gastritis aguda', keywords: ['epigastralgia', 'gastritis', 'acidez', 'reflujo', 'ardor estomacal'] },
  { code: '1F00', title: 'Infección aguda por COVID-19', keywords: ['covid', 'anosmia', 'ageusia', 'fiebre', 'dificultad respiratoria'] },
  { code: 'GB00', title: 'Infección de vías urinarias', keywords: ['disuria', 'disuria dolor', 'infección urinaria', 'polaquiuria'] }
];

class AICopilotService {
  
  async generatePatientSummary(patientName, medicalRecords = []) {
    if (!medicalRecords || medicalRecords.length === 0) {
      return {
        patientName,
        totalVisits: 0,
        summaryText: `El expediente de ${patientName} no registra consultas previas en el sistema.`,
        keyDiagnoses: [],
        prescribedDrugs: []
      };
    }

    const diagnosesSet = new Set();
    const drugsSet = new Set();

    medicalRecords.forEach(record => {
      if (record.diagnosis) diagnosesSet.add(record.diagnosis);
      if (record.prescriptions && Array.isArray(record.prescriptions)) {
        record.prescriptions.forEach(p => {
          if (p.drugName) drugsSet.add(p.drugName);
        });
      }
    });

    const recentRecord = medicalRecords[0];
    const summaryText = `Paciente ${patientName} con ${medicalRecords.length} consulta(s) registradas. Última atención el ${new Date(recentRecord.createdAt).toLocaleDateString('es-ES')} por motivo: "${recentRecord.symptoms || recentRecord.diagnosis || 'Chequeo general'}". Sintomatología tratada: ${recentRecord.symptoms || 'Sin especificar'}.`;

    return {
      patientName,
      totalVisits: medicalRecords.length,
      lastVisitDate: recentRecord.createdAt,
      summaryText,
      keyDiagnoses: Array.from(diagnosesSet),
      prescribedDrugs: Array.from(drugsSet)
    };
  }

  async suggestCIE11Codes(symptomsText = '', diagnosisText = '') {
    const textToAnalyze = `${symptomsText} ${diagnosisText}`.toLowerCase();

    const matches = [];

    CIE11_DICTIONARY.forEach(item => {
      let score = 0;
      item.keywords.forEach(kw => {
        if (textToAnalyze.includes(kw.toLowerCase())) {
          score += 25;
        }
      });

      if (score > 0) {
        matches.push({
          code: item.code,
          title: item.title,
          confidence: Math.min(score, 98) + '%',
          relevanceScore: score
        });
      }
    });

    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (matches.length === 0) {
      matches.push({
        code: 'MG30.Z',
        title: 'Símptomas o signos no especificados',
        confidence: '50%',
        relevanceScore: 10
      });
    }

    return matches.slice(0, 5);
  }
}

module.exports = new AICopilotService();
