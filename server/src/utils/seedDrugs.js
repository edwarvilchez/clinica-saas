const { Drug } = require('../models');

const drugs = [
  {
    name: 'Panadol',
    genericName: 'Paracetamol',
    activeComponents: 'Paracetamol 500mg',
    indications: 'Alivio del dolor y la fiebre. Dolores de cabeza, musculares, dentales, etc.',
    posology: 'Adultos: 1-2 tabletas cada 4-6 horas. Máximo 8 tabletas en 24 horas.',
    contraindications: 'Hipersensibilidad al paracetamol. Insuficiencia hepática severa.',
    adverseReactions: 'En raras ocasiones: náuseas, erupciones cutáneas, reacciones alérgicas.',
    precautions: 'No exceder la dosis recomendada. Consultar al médico si está embarazada.',
    presentation: 'Tabletas 500mg, Jarabe 120mg/5ml',
    category: 'Analgésico'
  },
  {
    name: 'Amoxil',
    genericName: 'Amoxicilina',
    activeComponents: 'Amoxicilina 500mg',
    indications: 'Infecciones bacterianas: otitis media, faringitis, neumonía, infecciones urinarias.',
    posology: 'Adultos: 250-500mg cada 8 horas. Según tipo de infección.',
    contraindications: 'Alergia a penicilinas o cefalosporinas.',
    adverseReactions: 'Diarrea, náuseas, erupciones cutáneas, reacciones alérgicas.',
    precautions: 'Usar con precaución en pacientes con insuficiencia renal.',
    presentation: 'Cápsulas 500mg, Suspensión 250mg/5ml',
    category: 'Antibiótico'
  },
  {
    name: 'Advil',
    genericName: 'Ibuprofeno',
    activeComponents: 'Ibuprofeno 400mg',
    indications: 'Alivio del dolor e inflamación. Artritis, dolores musculares, cefaleas.',
    posology: 'Adultos: 200-400mg cada 4-6 horas con alimentos.',
    contraindications: 'Úlcera péptica activa, insuficiencia cardíaca severa, tercer trimestre embarazo.',
    adverseReactions: 'Molestias gástricas, mareos, retención de líquidos.',
    precautions: 'Tomar con alimentos para minimizar irritación gástrica.',
    presentation: 'Tabletas 400mg, Suspensión 100mg/5ml',
    category: 'Antiinflamatorio'
  },
  {
    name: 'Losartan',
    genericName: 'Losartán potásico',
    activeComponents: 'Losartán potásico 50mg',
    indications: 'Hipertensión arterial, insuficiencia cardíaca, nefropatía diabética.',
    posology: 'Adultos: 50mg una vez al día. Ajustar según respuesta.',
    contraindications: 'Embarazo, hipersensibilidad al medicamento.',
    adverseReactions: 'Mareos, fatiga, hiperkalemia, dolor de cabeza.',
    precautions: 'Monitorear función renal y niveles de potasio.',
    presentation: 'Tabletas 50mg, 100mg',
    category: 'Antihipertensivo'
  },
  {
    name: 'Omeprazol',
    genericName: 'Omeprazol',
    activeComponents: 'Omeprazol 20mg',
    indications: 'Úlcera gástrica, reflujo gastroesofágico, ERGE, gastritis.',
    posology: 'Adultos: 20mg una vez al día antes del desayuno.',
    contraindications: 'Hipersensibilidad al omeprazol.',
    adverseReactions: 'Dolor de cabeza, diarrea, estreñimiento, náuseas.',
    precautions: 'Uso prolongado puede reducir absorción de vitamina B12.',
    presentation: 'Cápsulas 20mg',
    category: 'Gastrointestinal'
  },
  {
    name: 'Neurobion',
    genericName: 'Vitamina B1, B6, B12',
    activeComponents: 'Vitamina B1 100mg, B6 100mg, B12 5000mcg',
    indicaciones: 'Tratamiento de deficiencias vitamínicas del complejo B. Neuropatías.',
    posologia: '1 tableta al día o según indicación médica.',
    contraindications: 'Hipersensibilidad a cualquiera de los componentes.',
    adverseReactions: 'Raros: náuseas, vómitos, reacciones alérgicas.',
    precautions: 'No exceder la dosis recomendada.',
    presentation: 'Tabletas recubiertas',
    category: 'Vitamina'
  },
  {
    name: 'Aspirina',
    genericName: 'Ácido acetilsalicílico',
    activeComponents: 'Ácido acetilsalicílico 500mg',
    indications: 'Dolor, fiebre, inflamación. Prevención cardiovascular (baja dosis).',
    posology: 'Dolor: 500mg cada 4-6 horas. Prevención: 100mg una vez al día.',
    contraindications: 'Úlcera péptica, hemofilia, alergia a AINEs, niños con varicela.',
    adverseReactions: 'Irritación gástrica, sangrado, reacciones alérgicas.',
    precautions: 'No administrar a niños con síntomas virales.',
    presentation: 'Tabletas 500mg, 100mg',
    category: 'Analgesia'
  },
  {
    name: 'Voltaren',
    genericName: 'Diclofenaco sódico',
    activeComponents: 'Diclofenaco sódico 50mg',
    indications: 'Inflamación y dolor articular, muscular, postquirúrgico.',
    posology: 'Adultos: 25-50mg cada 8 horas con alimentos.',
    contraindications: 'Úlcera péptica activa, enfermedad coronaria, insuficiencia hepática severa.',
    adverseReactions: 'Dolor abdominal, diarrea, mareos, retención de líquidos.',
    precautions: 'Usar la menor dosis efectiva por最短 tiempo posible.',
    presentation: 'Tabletas 50mg, Gel tópico 1%',
    category: 'Antiinflamatorio'
  },
  {
    name: 'Keppra',
    genericName: 'Levetiracetam',
    activeComponents: 'Levetiracetam 500mg',
    indications: 'Epilepsia - convulsiones parciales o generalizadas.',
    posology: 'Adultos: 500mg dos veces al día. Ajustar según respuesta.',
    contraindications: 'Hipersensibilidad al levetiracetam.',
    adverseReactions: 'Somnolencia, mareos, fatiga, cambios de comportamiento.',
    precautions: 'No suspender abruptamente. Monitorear función renal.',
    presentation: 'Tabletas 500mg, 750mg, Solución oral 100mg/ml',
    category: 'Neurología'
  },
  {
    name: 'Aldomet',
    genericName: 'Metildopa',
    activeComponents: 'Metildopa 250mg',
    indications: 'Hipertensión arterial, especialmente en embarazo.',
    posology: 'Adultos: 250mg 2-3 veces al día. Dosis máxima 3g/día.',
    contraindications: 'Hepatitis activa, feocromocitoma, uso de inhibidores de MAO.',
    adverseReactions: 'Sedación, sequedad de boca, mareos, hepatitis.',
    precautions: 'Monitorear función hepática. Puede causar falso positivo en pruebas de laboratorio.',
    presentation: 'Tabletas 250mg, 500mg',
    category: 'Antihipertensivo'
  },
  {
    name: 'Primperan',
    genericName: 'Metoclopramida',
    activeComponents: 'Metoclopramida 10mg',
    indications: 'Náuseas, vómitos, gastroparesia, reflujo.',
    posology: 'Adultos: 10mg 3 veces al día antes de las comidas.',
    contraindications: 'Obstrucción intestinal, hemorragia gastrointestinal, epilepsia.',
    adverseReactions: 'Somnolencia, fatiga, efectos extrapiramidales, galactorrea.',
    precautions: 'No usar en niños sin supervisión médica.',
    presentation: 'Tabletas 10mg, Solución oral 5mg/5ml',
    category: 'Gastrointestinal'
  },
  {
    name: 'Augmentin',
    genericName: 'Amoxicilina/Ácido clavulánico',
    activeComponents: 'Amoxicilina 875mg + Ácido clavulánico 125mg',
    indications: 'Infecciones respiratorias, urinarias, de piel y tejidos blandos.',
    posology: 'Adultos: 875mg cada 12 horas con las comidas.',
    contraindications: 'Alergia a penicilinas, ictericia colestásica previa.',
    adverseReactions: 'Diarrea, náuseas, erupciones cutáneas, candidiasis.',
    precautions: 'Tomar con alimentos para reducir molestias gastrointestinales.',
    presentation: 'Tabletas 875/125mg, Suspensión 400/57mg/5ml',
    category: 'Antibiótico'
  },
  {
    name: 'Glucophage',
    genericName: 'Metformina',
    activeComponents: 'Metformina 500mg',
    indications: 'Diabetes mellitus tipo 2, SOP, prevención de diabetes.',
    posology: 'Adultos: 500mg con el desayuno y cena. Aumentar gradualmente.',
    contraindications: 'Insuficiencia renal, hepatopatía severa, acidosis metabólica.',
    adverseReactions: 'Náuseas, diarrea, dolor abdominal, pérdida de apetito.',
    precautions: 'Suspender antes de estudios con contraste yodado.',
    presentation: 'Tabletas 500mg, 850mg, 1000mg',
    category: 'Cardiovascular'
  },
  {
    name: 'Neosil',
    genericName: 'Cefalexina',
    activeComponents: 'Cefalexina 500mg',
    indications: 'Infecciones de piel, tejidos blandos, vías urinarias, respiratorias.',
    posology: 'Adultos: 250-500mg cada 6 horas.',
    contraindications: 'Alergia a cefalosporinas.',
    adverseReactions: 'Diarrea, náuseas, dolor abdominal, erupciones.',
    precautions: 'Usar con precaución en alérgicos a penicilinas.',
    presentation: 'Cápsulas 500mg, Suspensión 250mg/5ml',
    category: 'Antibiótico'
  },
  {
    name: 'Neurontin',
    genericName: 'Gabapentina',
    activeComponents: 'Gabapentina 300mg',
    indications: 'Epilepsia, dolor neuropático, síndrome de piernas inquietas.',
    posology: 'Adultos: 300mg 3 veces al día. Aumentar según tolerancia.',
    contraindications: 'Hipersensibilidad a la gabapentina.',
    adverseReactions: 'Somnolencia, mareos, fatiga, edema periférico.',
    precautions: 'No suspender abruptamente. Ajustar en insuficiencia renal.',
    presentation: 'Cápsulas 300mg, 400mg',
    category: 'Neurología'
  }
];

async function seedDrugs() {
  console.log('🌱 Iniciando seed de medicamentos...');

  try {
    for (const drug of drugs) {
      await Drug.findOrCreate({
        where: { name: drug.name },
        defaults: drug
      });
      console.log(`✅ Medicamento agregado: ${drug.name}`);
    }

    console.log(`\n✅ Se agregaron ${drugs.length} medicamentos a la base de datos.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al seedear medicamentos:', error);
    process.exit(1);
  }
}

seedDrugs();
