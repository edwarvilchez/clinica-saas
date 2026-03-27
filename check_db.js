require('dotenv').config({ path: './server/.env' });
const { LabResult, Patient, User } = require('./server/src/models');

async function check() {
  try {
    const total = await LabResult.count();
    console.log('--- DB SUMMARY ---');
    console.log(`Total LabResults in DB: ${total}`);
    
    if (total > 0) {
      const results = await LabResult.findAll({
        limit: 5,
        include: [{
          model: Patient,
          include: [User]
        }]
      });
      
      results.forEach((r, i) => {
        console.log(`Result ${i+1}: ${r.testName} - Patient: ${r.Patient?.User?.firstName || 'N/A'} - OrgID: ${r.Patient?.User?.organizationId || 'N/A'}`);
      });
    }
    process.exit(0);
  } catch (err) {
    console.error('ERROR CHECKING DB:', err);
    process.exit(1);
  }
}

check();
