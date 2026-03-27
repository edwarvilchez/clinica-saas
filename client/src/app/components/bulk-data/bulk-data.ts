import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../api-config';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-bulk-data',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './bulk-data.html',
  styleUrl: './bulk-data.css'
})
export class BulkData {
  selectedFile = signal<File | null>(null);
  importType = signal<'patients' | 'doctors'>('patients');
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

  setImportType(type: 'patients' | 'doctors') {
    this.importType.set(type);
    this.importResults.set(null);
  }

  async startImport() {
    const file = this.selectedFile();
    if (!file) {
      Swal.fire('Error', this.langService.translate('bulk_import.selectFileError'), 'error');
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
          Swal.fire(this.langService.translate('bulk_import.finished'), res.message || 'Ok', 'success');
        },
        error: (err: any) => {
          this.isImporting.set(false);
          const errorMsg = err.error?.error || this.langService.translate('bulk_import.importError');
          Swal.fire('Error', errorMsg, 'error');
        }
      });
  }

  downloadTemplate() {
    const type = this.importType();
    let csvContent = '';
    
    if (type === 'patients') {
      csvContent = 'firstName,lastName,email,username,password,documentId,birthDate,gender,phone,address,bloodType,allergies\n' +
                   'Juan,Perez,juan@ejemplo.com,jperez,ClinicaSaaS123!,12345678,1990-05-15,Male,04121234567,Caracas,O+,Ninguna';
    } else {
      csvContent = 'firstName,lastName,email,username,password,licenseNumber,phone,address,specialty,gender\n' +
                   'Maria,Gomez,maria@ejemplo.com,mgomez,ClinicaSaaS123!,MPPS-9999,04247654321,Valencia,Cardiologia,Female';
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
