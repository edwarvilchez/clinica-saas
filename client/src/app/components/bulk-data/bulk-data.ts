import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../api-config';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import Swal from 'sweetalert2';

export type ImportCategory = 'patients' | 'doctors' | 'lab_catalog' | 'insurance_companies' | 'inventory' | 'baremos';

@Component({
  selector: 'app-bulk-data',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './bulk-data.html',
  styleUrl: './bulk-data.css'
})
export class BulkData {
  selectedFile = signal<File | null>(null);
  importType = signal<ImportCategory>('patients');
  isImporting = signal(false);
  importResults = signal<any>(null);

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    public langService: LanguageService
  ) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
      console.log('File selected:', file.name);
    }
  }

  setImportType(type: ImportCategory) {
    this.importType.set(type);
    this.importResults.set(null);
  }

  async startImport() {
    const file = this.selectedFile();
    if (!file) {
      Swal.fire('Error', this.langService.translate('bulk_import.selectFileError') || 'Seleccione un archivo CSV', 'error');
      return;
    }

    this.isImporting.set(true);
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.post(`${API_URL}/bulk/import/${this.importType()}`, formData, { headers })
      .subscribe({
        next: (res: any) => {
          this.isImporting.set(false);
          this.importResults.set(res);
          Swal.fire(this.langService.translate('bulk_import.finished') || 'Importación Finalizada', res.message || 'Ok', 'success');
        },
        error: (err: any) => {
          this.isImporting.set(false);
          const errorMsg = err.error?.error || err.error?.message || this.langService.translate('bulk_import.importError') || 'Error al importar datos';
          Swal.fire('Error', errorMsg, 'error');
        }
      });
  }

  downloadTemplate() {
    const type = this.importType();
    let csvContent = '';
    
    if (type === 'patients') {
      csvContent = 'firstName,lastName,email,username,password,documentId,birthDate,gender,phone,address,bloodType,allergies\n' +
                   'Juan,Perez,juan@ejemplo.com,jperez,ClinicaSaaS2026!,12345678,1990-05-15,Male,04121234567,Caracas,O+,Ninguna';
    } else if (type === 'doctors') {
      csvContent = 'firstName,lastName,email,username,password,licenseNumber,phone,address,specialty,gender\n' +
                   'Maria,Gomez,maria@ejemplo.com,mgomez,ClinicaSaaS2026!,MPPS-9999,04247654321,Valencia,Cardiologia,Female';
    } else if (type === 'lab_catalog') {
      csvContent = 'name,price,category,description\n' +
                   'Hematologia Completa,15.00,Laboratorio,Analisis de sangre completo con todos los valores.';
    } else if (type === 'insurance_companies') {
      csvContent = 'name,rif,phone,email,contactPerson,defaultCoveragePercent,paymentTermDays,notes\n' +
                   'Seguros Caracas C.A.,J-00038234-5,02122018111,convenios@seguroscaracas.com,Lcda. Valentina Ramos,80.00,30,Convenio activo de hospitalización y emergencias\n' +
                   'Mercantil Seguros C.A.,J-00084572-9,02125031111,salud@mercantilseguros.com,Dr. Roberto Blanco,85.00,45,Pólizas colectivas y corporativas';
    } else if (type === 'inventory') {
      csvContent = 'code,name,itemType,category,unit,costUSD,priceUSD,stockCurrent,stockMin,batchNumber,expiryDate,location\n' +
                   'MED-101,Omeprazol 40mg Ampolla Inyectable,MEDICATION,MEDICINE,AMPOLLA,1.50,4.50,150,20,LOTE-2026A,2027-12-31,Farmacia Central\n' +
                   'MAT-201,Compresas Laparotomía Estériles (Paq 5),SUPPLY,SURGICAL_MATERIAL,PAQUETE,4.50,12.00,80,15,LOTE-8821,2028-05-30,Almacén Quirófano\n' +
                   'SOL-301,Solución Fisiológica 0.9% 500ml,SUPPLY,HOSPITAL_SUPPLY,FRASCO,1.20,3.50,200,30,LOTE-7714,2027-08-15,Piso 1 Hospitalización';
    } else if (type === 'baremos') {
      csvContent = 'code,name,category,priceUSD,doctorFeePercent,doctorFeeFixedUSD,description\n' +
                   'CONS-ESP-01,Consulta Médica Especializada,CONSULTATION,50.00,70.00,0.00,Evaluación clínica integral por especialista\n' +
                   'ECO-ABD-01,Ecosonograma Abdominal Completo,PROCEDURE,45.00,60.00,0.00,Estudio ecosonográfico abdominal con informe médico\n' +
                   'QX-APEND-01,Apendicectomía Laparoscópica,SURGERY,1200.00,65.00,0.00,Intervención quirúrgica laparoscópica completa con equipo quirúrgico';
    }

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const baseFilename = this.langService.translate('bulk_import.template_filename');
      link.setAttribute('download', `${baseFilename}_${type}.csv`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error('Download failed', e);
      Swal.fire('Error', 'No se pudo generar la descarga', 'error');
    }
  }
}
