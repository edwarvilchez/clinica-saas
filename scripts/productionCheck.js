'use strict';

/**
 * Root wrapper for Clinica-SaaS Production Readiness Check
 * Instantiates and executes ProductionReadinessChecker from server
 */

const path = require('path');
const { ProductionReadinessChecker } = require('../server/src/scripts/productionCheck');

const isNonStrict = process.argv.includes('--non-strict');
const checker = new ProductionReadinessChecker({ strict: !isNonStrict });
checker
  .runAll()
  .then(report => {
    checker.printFormattedReport(report);
    process.exit(report.isReady ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error during production readiness check:', err);
    process.exit(1);
  });
