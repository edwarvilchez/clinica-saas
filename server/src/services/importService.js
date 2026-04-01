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

function validateRecord(type, record) {
  const errors = [];
  if (type === 'patients' || type === 'doctors') {
    if (!record.username || !record.email) errors.push('Missing username or email');
    if (type === 'doctors' && !record.licenseNumber) errors.push('Missing licenseNumber for doctor');
    if (record.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(record.email)) errors.push('Invalid email');
  } else if (type === 'lab_catalog') {
    if (!record.name) errors.push('Missing name for lab test');
    if (!record.price) errors.push('Missing price for lab test');
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
