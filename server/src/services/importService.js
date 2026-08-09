const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

// Try to load ExcelJS, but don't fail if it's not available
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch (err) {
  console.warn('ExcelJS not available. Excel file import will be disabled.');
  ExcelJS = null;
}

function isCsvFile(filePath) {
  return ['.csv'].includes(path.extname(filePath).toLowerCase());
}

function isXlsxFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.xls', '.xlsx'].includes(ext);
}

function validateRecord(type, record, rowIndex = 1) {
  const errors = [];
  if (type === 'patients' || type === 'doctors') {
    if (!record.username || !record.email) errors.push({ row: rowIndex, field: 'username/email', message: 'Falta nombre de usuario o correo electrónico' });
    if (type === 'doctors' && !record.licenseNumber) errors.push({ row: rowIndex, field: 'licenseNumber', message: 'Falta la licencia médica obligatoria' });
    if (record.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(record.email)) errors.push({ row: rowIndex, field: 'email', message: `Formato de correo electrónico inválido: '${record.email}'` });
  } else if (type === 'lab_catalog') {
    if (!record.name) errors.push({ row: rowIndex, field: 'name', message: 'Falta el nombre de la prueba de laboratorio' });
    if (!record.price || isNaN(parseFloat(record.price))) errors.push({ row: rowIndex, field: 'price', message: 'Falta el precio o valor numérico inválido' });
  } else if (type === 'medical_history') {
    if (!record.patientDocumentId && !record.patientEmail) errors.push({ row: rowIndex, field: 'patientDocumentId', message: 'Se requiere cédula o email del paciente' });
    if (!record.diagnosis && !record.symptoms) errors.push({ row: rowIndex, field: 'diagnosis', message: 'Se requieren síntomas o diagnóstico' });
  } else if (type === 'pharmacy_inventory') {
    if (!record.name) errors.push({ row: rowIndex, field: 'name', message: 'Falta el nombre comercial del medicamento' });
    if (!record.stock || isNaN(parseInt(record.stock))) errors.push({ row: rowIndex, field: 'stock', message: 'Cantidad de stock requerida' });
  }
  return errors;
}

async function parseCsv(filePath) {
  const records = [];
  const parser = fs.createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true })
  );
  for await (const record of parser) {
    records.push(record);
  }
  return records;
}

async function parseXlsx(filePath) {
  if (!ExcelJS) {
    throw new Error('ExcelJS is not installed. Please install it to import Excel files.');
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const rows = [];
  const headerRow = worksheet.getRow(1).values;
  const headers = headerRow.slice(1).map(h => String(h || '').trim());
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const rowValues = row.values.slice(1);
    const record = {};
    headers.forEach((h, i) => { record[h] = rowValues[i] !== undefined ? String(rowValues[i]).trim() : ''; });
    rows.push(record);
  });
  return rows;
}

module.exports = {
  isCsvFile,
  isXlsxFile,
  validateRecord,
  parseCsv,
  parseXlsx
};
