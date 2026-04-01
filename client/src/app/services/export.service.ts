import { Injectable } from '@angular/core';
import { LanguageService } from './language.service';

export interface BrandingInfo {
  name: string;
  tagline?: string;
  address?: string;
  professional?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private defaultBranding: BrandingInfo = {
    name: 'MedicalCare 888',
    tagline: 'Healthcare Management System',
    address: 'Global Solutions'
  };

  constructor(private langService: LanguageService) {
    this.updateDefaultBranding();
  }

  private updateDefaultBranding() {
    this.defaultBranding = {
      name: 'MedicalCare 888',
      tagline: this.langService.translate('landing.description').substring(0, 40) + '...',
      address: 'Cloud Healthcare'
    };
  }

  /**
   * Export data to CSV
   */
  exportToCsv(filename: string, headers: string[], rows: any[][]) {
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(',')) 
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Export data to Excel (XLSX)
   */
  async exportToExcel(filename: string, headers: string[], rows: any[][], branding?: BrandingInfo) {
    const { default: ExcelJS } = await import('exceljs');
    const brand = { ...this.defaultBranding, ...branding };
    const data = [
      [brand.name.toUpperCase()],
      [brand.tagline || ''],
      [''],
      headers,
      ...rows
    ];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte');

    // Add rows
    data.forEach(r => sheet.addRow(r));

    // Auto-size columns based on headers and rows
    const colCount = headers.length;
    const colWidths = new Array(colCount).fill(10);
    for (let i = 0; i < colCount; i++) {
      let maxLen = String(headers[i] || '').length;
      rows.forEach(r => {
        const cell = String(r[i] || '');
        if (cell.length > maxLen) maxLen = cell.length;
      });
      colWidths[i] = { width: Math.min(Math.max(maxLen + 2, 10), 50) };
    }
    sheet.columns = colWidths as any;

    // Write workbook to buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export data to PDF with Premium Design and Dynamic Branding
   */
  async exportToPdf(filename: string, title: string, headers: string[], rows: any[][], branding?: BrandingInfo) {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const brand = { ...this.defaultBranding, ...branding };

    // --- PREMIUM HEADER ---
    doc.setFillColor(14, 165, 233); 
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Logo Text / Clinic Name
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18); // Tamaño más equilibrado
    doc.text(brand.name.toUpperCase(), 15, 18);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const tagline = brand.tagline || 'PLATAFORMA MÉDICA INTEGRAL';
    doc.text(tagline.toUpperCase(), 15, 24);

    // --- Clinica SaaS BRANDING (Small corner) ---
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('POWERED BY MedicalCare 888', 15, 35);

    // Document Title (Right aligned, on a different level to avoid overlap)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(255, 255, 255, 0.2); // Sutil fondo para el título
    doc.text(title.toUpperCase(), pageWidth - 15, 35, { align: 'right' });

    // Header Details Box (Lower and cleaner)
    doc.setFillColor(248, 250, 252); 
    doc.rect(15, 45, pageWidth - 30, 25, 'F');
    doc.setDrawColor(226, 232, 240); 
    doc.rect(15, 45, pageWidth - 30, 25, 'S');

    doc.setTextColor(71, 85, 105); 
    doc.setFontSize(8);
    
    doc.setFont('helvetica', 'bold');
    doc.text('EMITIDO POR:', 22, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(brand.professional ? `Dr(a). ${brand.professional}` : brand.name, 45, 54);

    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', 22, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString(), 35, 60);

    doc.setFont('helvetica', 'bold');
    doc.text('UBICACIÓN:', 22, 66);
    doc.setFont('helvetica', 'normal');
    doc.text(brand.address || 'N/A', 43, 66);

    // --- MAIN CONTENT TABLE ---
    autoTable(doc, {
      startY: 80,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 41, 59], 
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [51, 65, 85],
        cellPadding: 3,
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        ...headers.reduce((acc: any, _, i) => { acc[i] = { halign: 'center' }; return acc; }, {})
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // --- FOOTER ---
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); 
        doc.setDrawColor(241, 245, 249);
        doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

        const str = `Página ${data.pageNumber} de ${doc.internal.pages.length - 1 || 1}`;
        doc.text(str, pageWidth / 2, pageHeight - 12, { align: 'center' });
        
        doc.text(brand.address || '', 15, pageHeight - 12);
        doc.text(`Powered by MedicalCare 888`, pageWidth - 15, pageHeight - 12, { align: 'right' });
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY < pageHeight - 40) {
        doc.setDrawColor(14, 165, 233, 0.4);
        doc.setLineWidth(0.5);
        doc.rect(pageWidth - 75, finalY, 60, 18);
        doc.setTextColor(14, 165, 233);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('DOCUMENTO CERTIFICADO', pageWidth - 45, finalY + 7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(brand.name.toUpperCase(), pageWidth - 45, finalY + 11, { align: 'center' });
        doc.setFontSize(7);
        doc.text('ID VERIFICACIÓN: SFX-' + Math.random().toString(36).substring(7).toUpperCase(), pageWidth - 45, finalY + 15, { align: 'center' });
    }

    doc.save(`${filename}.pdf`);
  }
}
