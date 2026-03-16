const { LabTest, LabCombo } = require('./src/models');

async function seedLabCatalog() {
  try {
    console.log('Seeding Lab Catalog...');
    
    // Individual Tests
    const tests = [
      { name: 'Hematología Completa', price: 15.00, category: 'Hematología', description: 'Recuento de glóbulos blancos, rojos y plaquetas.' },
      { name: 'Glicemia', price: 5.00, category: 'Química', description: 'Medición de glucosa en sangre.' },
      { name: 'Creatinina', price: 6.00, category: 'Química', description: 'Evaluación de función renal.' },
      { name: 'Urea', price: 6.00, category: 'Química', description: 'Evaluación de función renal.' },
      { name: 'Perfil Lipídico', price: 25.00, category: 'Química', description: 'Colesterol Total, HDL, LDL y Triglicéridos.' },
      { name: 'Examen de Orina', price: 5.00, category: 'Urianálisis', description: 'Análisis físico, químico y microscópico.' },
      { name: 'Examen de Heces', price: 5.00, category: 'Coprología', description: 'Búsqueda de parásitos y sangre oculta.' },
      { name: 'HIV (SIDA) - Cuantitativo', price: 30.00, category: 'Serología', description: 'Detección de anticuerpos VIH 1 y 2.' },
      { name: 'VDRL', price: 8.00, category: 'Serología', description: 'Prueba de despistaje de Sífilis.' }
    ];

    const createdTests = await Promise.all(tests.map(t => LabTest.create(t)));
    console.log(`Created ${createdTests.length} tests.`);

    // Combos
    const combo1 = await LabCombo.create({
      name: 'Perfil 20 (General)',
      totalPrice: 45.00,
      description: 'Los exámenes más comunes para un chequeo preventivo general.'
    });
    
    // Add some tests to the combo
    const hematologia = createdTests.find(t => t.name.includes('Hematología'));
    const glicemia = createdTests.find(t => t.name === 'Glicemia');
    const renal1 = createdTests.find(t => t.name === 'Creatinina');
    const renal2 = createdTests.find(t => t.name === 'Urea');
    const orina = createdTests.find(t => t.name.includes('Orina'));
    
    if (combo1) {
      await combo1.addTests([hematologia, glicemia, renal1, renal2, orina]);
    }

    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding lab catalog:', error);
  } finally {
    process.exit();
  }
}

seedLabCatalog();
