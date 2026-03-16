import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { MedicalService } from '../../services/medical.service';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../api-config';
import Swal from 'sweetalert2';

import { LanguageService } from '../../services/language.service';
import { ExportService } from '../../services/export.service';
import { AuthService } from '../../services/auth.service';
import { DrugService, Drug } from '../../services/drug.service';

@Component({
  selector: 'app-medical-history',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './medical-history.html',
  styleUrl: './medical-history.css',
})
export class MedicalHistory implements OnInit {
  patientId = signal<string>('');
  patient = signal<any>(null);
  records = signal<any[]>([]);
  labs = signal<any[]>([]);
  
  // Prescription management
  prescriptionsList = signal<any[]>([]);
  drugSearchResults = signal<Drug[]>([]);
  isSearchingDrugs = signal(false);
  drugSearchControl = new FormControl('');
  
  showRecordModal = signal(false);
  activeTab = signal<'consultations' | 'labs' | 'treatments'>('consultations');
  recordForm: FormGroup;

  patients = signal<any[]>([]);

  constructor(
    private medicalService: MedicalService,
    private http: HttpClient,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    public langService: LanguageService,
    private exportService: ExportService,
    public authService: AuthService,
    private drugService: DrugService
  ) {
    this.recordForm = this.fb.group({
      diagnosis: ['', Validators.required],
      treatment: [''],
      indications: [''],
      physicalExam: [''],
      medicalLeaveDays: [0],
      medicalLeaveStartDate: [''],
      medicalLeaveEndDate: [{value: '', disabled: true}],
      patientId: [''],
      doctorId: ['']
    });

    // Auto-calculate End Date
    this.recordForm.valueChanges.subscribe(val => {
        const days = Number(val.medicalLeaveDays);
        const dateStr = val.medicalLeaveStartDate;

        if (days > 0 && dateStr) {
            // Create date using local time components to avoid UTC shifts
            const parts = dateStr.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
            const day = parseInt(parts[2], 10);

            const resultDate = new Date(year, month, day);
            
            // Add days - 1 (inclusive logic: 1 day starts and ends same day)
            resultDate.setDate(resultDate.getDate() + (days - 1));
            
            // Get local ISO string YYYY-MM-DD
            const y = resultDate.getFullYear();
            const m = String(resultDate.getMonth() + 1).padStart(2, '0');
            const d = String(resultDate.getDate()).padStart(2, '0');
            const finalDate = `${y}-${m}-${d}`;
            
            if (this.recordForm.get('medicalLeaveEndDate')?.value !== finalDate) {
                this.recordForm.patchValue({
                    medicalLeaveEndDate: finalDate
                }, { emitEvent: false });
            }
        } else {
             if (this.recordForm.get('medicalLeaveEndDate')?.value !== '') {
                this.recordForm.patchValue({
                    medicalLeaveEndDate: ''
                }, { emitEvent: false });
             }
        }
    });
  }

  ngOnInit() {
    this.loadPatients();
    this.route.queryParams.subscribe(params => {
        if(params['id']) {
            this.selectPatient(params['id']);
        }
    });

    // Drug Autocomplete Logic
    this.drugSearchControl.valueChanges.subscribe((val: string | null) => {
      if (val && val.length > 2) {
        this.isSearchingDrugs.set(true);
        this.drugService.getAll({ search: val, limit: 10 }).subscribe({
          next: (res) => {
            this.drugSearchResults.set(res.drugs);
            this.isSearchingDrugs.set(false);
          },
          error: () => this.isSearchingDrugs.set(false)
        });
      } else {
        this.drugSearchResults.set([]);
      }
    });
  }

  loadPatients() {
    this.http.get<any[]>(`${API_URL}/patients`).subscribe(data => this.patients.set(data));
  }

  selectPatient(id: string) {
    this.patientId.set(id);
    const p = this.patients().find(x => x.id === id);
    if(p) this.patient.set(p);
    
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('id', id);
    window.history.pushState({}, '', url);

    this.loadHistory();
  }

  loadHistory() {
    if(!this.patientId()) return;
    this.medicalService.getPatientHistory(this.patientId()).subscribe({
        next: (data) => {
            console.log('Records loaded:', data);
            this.records.set(data);
        },
        error: (err) => {
            console.error('Error loading history:', err);
            Swal.fire('Error', 'No se pudo cargar el historial médico.', 'error');
        }
    });
    
    this.medicalService.getPatientLabs(this.patientId()).subscribe({
        next: (data) => this.labs.set(data),
        error: (err) => console.error('Error loading labs:', err)
    });
  }

  openRecordModal() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.recordForm.patchValue({
        patientId: this.patientId(),
        doctorId: user.id
    });
    this.showRecordModal.set(true);
  }

  addPrescription(drug: Drug) {
    const exists = this.prescriptionsList().find(x => x.drugName === drug.name);
    if (exists) return;

    this.prescriptionsList.set([...this.prescriptionsList(), {
      drugId: drug.id,
      drugName: drug.name,
      dosage: '',
      frequency: '',
      duration: '',
      instructions: ''
    }]);
    this.drugSearchControl.setValue('', { emitEvent: false });
    this.drugSearchResults.set([]);
  }

  removePrescription(index: number) {
    const list = [...this.prescriptionsList()];
    list.splice(index, 1);
    this.prescriptionsList.set(list);
  }

  submitRecord() {
    if(this.recordForm.valid) {
        const formData = { 
          ...this.recordForm.getRawValue(),
          prescriptions: this.prescriptionsList()
        };
        
        // Handle empty date string
        if (!formData.medicalLeaveStartDate) {
            formData.medicalLeaveStartDate = null;
            formData.medicalLeaveEndDate = null;
        }

        this.medicalService.createRecord(formData).subscribe({
            next: () => {
                this.loadHistory();
                this.showRecordModal.set(false);
                this.recordForm.reset({
                  medicalLeaveDays: 0,
                  patientId: this.patientId(),
                  doctorId: this.recordForm.get('doctorId')?.value
                });
                this.prescriptionsList.set([]);
                Swal.fire(
                  this.langService.translate('common.success'), 
                  this.langService.translate('medical_history.save'), 
                  'success'
                );
            },
            error: (err) => {
                console.error(err);
                const errorMsg = err.error?.error || 'No se pudo guardar el registro.';
                Swal.fire(
                  this.langService.translate('common.error'), 
                  errorMsg, 
                  'error'
                );
            }
        });
    }
  }

  printRecord(rec: any) {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;

    const patientName = `${this.patient()?.User?.firstName} ${this.patient()?.User?.lastName}`;
    const doctorName = `Dr. ${rec.Doctor?.User?.firstName} ${rec.Doctor?.User?.lastName}`;
    const date = new Date(rec.createdAt).toLocaleDateString();

    let leaveHtml = '';
    if (rec.medicalLeaveDays > 0) {
        const startDate = new Date(rec.medicalLeaveStartDate).toLocaleDateString();
        // Use backend end date OR calculate roughly if missing for legacy records
        let endDate = '';
        if (rec.medicalLeaveEndDate) {
             endDate = new Date(rec.medicalLeaveEndDate).toLocaleDateString();
        } else {
             // Fallback calculation for display
             const d = new Date(rec.medicalLeaveStartDate);
             d.setDate(d.getDate() + (rec.medicalLeaveDays - 1));
             endDate = d.toLocaleDateString();
        }

        leaveHtml = `
      <div class="section leave">
        <h3>Suspensión Médica (Reposo)</h3>
        <p><strong>Días:</strong> ${rec.medicalLeaveDays}</p>
        <p><strong>Desde:</strong> ${startDate}</p>
        <p><strong>Hasta:</strong> ${endDate}</p>
      </div>`;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Informe Médico - ${patientName}</title>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #0ea5e9; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
            .section { margin-bottom: 25px; }
            h3 { color: #0ea5e9; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
            p { margin: 5px 0; }
            .leave { background: #fffbeb; padding: 15px; border-radius: 8px; border: 1px solid #fcd34d; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">MEDICUS</div>
            <div>Informe Médico Clínico</div>
          </div>
          
          <div class="meta">
            <div>
              <strong>Paciente:</strong> ${patientName}<br>
              <strong>ID:</strong> ${this.patient()?.documentId}
            </div>
            <div style="text-align: right;">
              <strong>Fecha:</strong> ${date}<br>
              <strong>Médico Tratante:</strong> ${doctorName}
            </div>
          </div>

          <div class="section">
            <h3>Diagnóstico</h3>
            <p>${rec.diagnosis}</p>
          </div>

          ${rec.physicalExam ? `
          <div class="section">
            <h3>Examen Físico</h3>
            <p>${rec.physicalExam}</p>
          </div>` : ''}

          ${rec.treatment ? `
          <div class="section">
            <h3>Tratamiento</h3>
            <p>${rec.treatment}</p>
          </div>` : ''}

          ${rec.indications ? `
          <div class="section">
            <h3>Indicaciones</h3>
            <p>${rec.indications}</p>
          </div>` : ''}

          ${rec.prescriptions && rec.prescriptions.length > 0 ? `
          <div class="section">
            <h3>Receta Médica (Rp)</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                  <th style="text-align: left; padding: 10px;">Medicamento</th>
                  <th style="text-align: left; padding: 10px;">Dosis / Frecuencia</th>
                  <th style="text-align: left; padding: 10px;">Duración</th>
                </tr>
              </thead>
              <tbody>
                ${rec.prescriptions.map((p: any) => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px;">
                      <strong>${p.drugName}</strong><br>
                      <small style="color: #64748b;">${p.instructions || ''}</small>
                    </td>
                    <td style="padding: 10px;">${p.dosage || ''} - ${p.frequency || ''}</td>
                    <td style="padding: 10px;">${p.duration || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : ''}

          ${leaveHtml}

          <div class="footer">
            <p>Generado electrónicamente por Medicus Platform</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    // setTimeout(() => printWindow.print(), 500); // Optional: auto print
  }

  exportHistory() {
    if (this.records().length === 0) {
      Swal.fire('Atención', 'No hay registros médicos para exportar', 'warning');
      return;
    }

    const patientName = `${this.patient()?.User?.firstName} ${this.patient()?.User?.lastName}`;
    const headers = ['Fecha', 'Médico', 'Diagnóstico', 'Tratamiento'];
    const rows = this.records().map(r => [
      new Date(r.createdAt).toLocaleDateString(),
      `Dr. ${r.Doctor?.User?.firstName} ${r.Doctor?.User?.lastName}`,
      r.diagnosis,
      r.treatment || 'N/A'
    ]);

    Swal.fire({
      title: 'Exportar Historia Médica',
      text: 'Seleccione el formato de descarga',
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-file-pdf"></i> PDF',
      denyButtonText: '<i class="bi bi-file-excel"></i> Excel',
      cancelButtonText: '<i class="bi bi-file-text"></i> CSV',
      confirmButtonColor: '#ef4444',
      denyButtonColor: '#22c55e',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      const filename = `Historia_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
      const title = `Historia Médica: ${patientName}`;
      const user = this.authService.currentUser();
      const branding = {
        name: user?.businessName || (user?.accountType === 'PROFESSIONAL' ? `${user.firstName} ${user.lastName}` : 'Medicus Platform'),
        professional: user ? `${user.firstName} ${user.lastName}` : undefined,
        tagline: this.langService.translate('medical_history.subtitle')
      };
      
      if (result.isConfirmed) {
        this.exportService.exportToPdf(filename, title, headers, rows, branding);
      } else if (result.isDenied) {
        this.exportService.exportToExcel(filename, headers, rows, branding);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.exportService.exportToCsv(filename, headers, rows);
      }
    });
  }
}
