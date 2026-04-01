import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LabReport } from '../components/lab-results/lab-report.model';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';

@Injectable({
  providedIn: 'root'
})
export class LabPdfService {

  constructor(
    private authService: AuthService,
    private langService: LanguageService
  ) {}

  // Método privado para crear el documento
  private createDoc(report: LabReport): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const user = this.authService.currentUser();
    const isEs = this.langService.lang() === 'es';
    
    // Branding Setup
    const branding = {
      name: user?.businessName || (user?.accountType === 'PROFESSIONAL' ? `${user.firstName} ${user.lastName}` : 'MedicalCare 888'),
      tagline: user?.businessName ? 'Servicios de Salud Integrales' : 'Gestión Médica Profesional'
    };

    // --- CABECERA PREMIUM (Clinica SaaS Header) ---
    // Background Accent (Top Blue Bar)
    doc.setFillColor(14, 165, 233); // #10b981 (Clinica SaaS Blue)
    doc.rect(0, 0, pageWidth, 2, 'F');

    // Heartbeat Icon / Logo Placeholder (Stylized Heart)
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(1);
    doc.line(14, 15, 18, 15);
    doc.line(18, 15, 20, 10);
    doc.line(20, 10, 23, 20);
    doc.line(23, 20, 25, 15);
    doc.line(25, 15, 30, 15);

    // Branding Name (Izquierda Superior)
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(branding.name.toUpperCase(), 35, 18);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'medium'); // Try helvetica-bold if medium is not available
    doc.setTextColor(14, 165, 233); // Clinica SaaS Blue
    doc.text(branding.tagline.toUpperCase(), 35, 23);

    // Platform Identity (Top Right)
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text('POWERED BY MedicalCare 888', pageWidth - 14, 8, { align: 'right' });

    // Lab Order / Document ID (Derecha)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(report.header.labOrder, pageWidth - 14, 18, { align: 'right' });
    
    // Line Separator (Main)
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 28, pageWidth - 14, 28);

    // Patient Data Block (Modern Card Style)
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.roundedRect(14, 32, pageWidth - 28, 25, 2, 2, 'F');
    
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // Slate-600
    
    let y = 39;
    const col1 = 18;
    const col2 = 115;
    const col3 = 145;
    const col4 = 172;
    
    // Labels Header (Upper line of the gray block)
    doc.setFont('helvetica', 'bold');
    doc.text(isEs ? 'PACIENTE' : 'PATIENT', col1, y);
    doc.text(isEs ? 'SEXO' : 'SEX', col2, y);
    doc.text(isEs ? 'EDAD' : 'AGE', col3, y);
    doc.text(isEs ? 'INGRESO' : 'ENTRY', col4, y);
    
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(`${report.header.patientName}`, col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`C.I: ${report.header.ci}`, col1, y + 4);
    
    doc.text(report.header.sex, col2, y);
    doc.text(`${report.header.age} ${isEs ? 'Años' : 'Years'}`, col3, y);
    doc.text(report.header.entryDate, col4, y);

    y = 53;
    // Lower line inside block (Address and Phone only)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(isEs ? 'DIRECCIÓN' : 'ADDRESS', col1, y);
    doc.text(isEs ? 'TELÉFONO' : 'PHONE', col2, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(report.header.address.toUpperCase(), col1 + 22, y);
    doc.text(report.header.phone, col2 + 20, y);

    y = 65;

    // --- SECCIONES ---
    report.sections.forEach(section => {
      // Modern Section Title
      doc.setFillColor(15, 23, 42); // Dark background
      doc.roundedRect(14, y, 6, 6, 1, 1, 'F'); // Square accent
      
      doc.setTextColor(15, 23, 42); 
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title.toUpperCase(), 23, y + 5);
      
      doc.setDrawColor(14, 165, 233); // Clinica SaaS Blue line
      doc.setLineWidth(1);
      doc.line(23, y + 7, 60, y + 7); 

      y += 12;

      autoTable(doc, {
        startY: y,
        head: [[
          isEs ? 'ESTUDIO / PARÁMETRO' : 'STUDY / PARAMETER', 
          isEs ? 'RESULTADO' : 'RESULT', 
          isEs ? 'UNIDAD' : 'UNIT', 
          isEs ? 'VALORES DE REFERENCIA' : 'REFERENCE RANGE'
        ]],
        body: section.items.map(item => [
          item.description,
          item.result,
          item.units,
          item.referenceValues
        ]),
        theme: 'striped', // Modern look
        headStyles: {
          fillColor: [15, 23, 42], // Slate-900 header
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 3
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 4,
          valign: 'middle',
          font: 'helvetica'
        },
        columnStyles: {
          0: { cellWidth: 90, fontStyle: 'bold' },
          1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 35, halign: 'center' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50 stripes
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const rowItem = section.items[data.row.index];
            if (rowItem.isAbnormal) {
              data.cell.styles.textColor = [220, 38, 38]; // Abnormal Red
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      // @ts-ignore
      y = doc.lastAutoTable.finalY + 15;
    });

    // Final Certification Footer
    const footerY = doc.internal.pageSize.height - 40;
    doc.setDrawColor(226, 232, 240);
    doc.line( pageWidth / 2 - 30, footerY - 5, pageWidth / 2 + 30, footerY - 5);
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(isEs ? 'VALIDADO POR SISTEMA' : 'SYSTEM VALIDATED', pageWidth / 2, footerY, { align: 'center' });
    doc.text(branding.name.toUpperCase(), pageWidth / 2, footerY + 4, { align: 'center' });

    return doc;
  }

  generatePDF(report: LabReport) {
    const doc = this.createDoc(report);
    const filename = `Lab_${report.header.labOrder}_${report.header.patientName.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  }

  viewPDF(report: LabReport) {
    const doc = this.createDoc(report);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}
