import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { LabPdfService } from '../../services/lab-pdf.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { LabReport, HEMATOLOGY_STRUCTURE, CHEMISTRY_STRUCTURE } from './lab-report.model';
import { LabCatalogService, LabTest } from '../../services/lab-catalog.service';
import { AuthService } from '../../services/auth.service';
import { MedicalService } from '../../services/medical.service';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../api-config';
import { CurrencyService } from '../../services/currency.service';

@Component({
  selector: 'app-lab-results',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './lab-results.html',
  styleUrls: []
})
export class LabResults implements OnInit {
  searchControl = new FormControl('');
  typeFilter = new FormControl('');
  statusFilter = new FormControl('');
  
  private allResults = signal<any[]>([]);

  labResults = computed(() => {
    const term = this.searchControl.value?.toLowerCase() || '';
    const type = this.typeFilter.value;
    const status = this.statusFilter.value;

    return this.allResults().filter(r => {
      const matchSearch = r.patientName.toLowerCase().includes(term) || 
                          r.patientId.toLowerCase().includes(term) ||
                          r.testType.toLowerCase().includes(term);
      const matchType = !type || r.category === type;
      const matchStatus = !status || r.status === status;
      return matchSearch && matchType && matchStatus;
    });
  });

  currentUser = signal<any>(null);
  canManage = signal(false);
  canViewPrices = signal(false);
  isPatient = signal(false);
  catalogTests = signal<LabTest[]>([]);
  patients = signal<any[]>([]);

  constructor(
    private pdfService: LabPdfService,
    public langService: LanguageService,
    private authService: AuthService,
    private medicalService: MedicalService,
    private catalogService: LabCatalogService,
    public currencyService: CurrencyService,
    private http: HttpClient
  ) {
    this.currentUser.set(this.authService.currentUser());
    const role = this.currentUser()?.Role?.name;
    this.canManage.set(['SUPERADMIN', 'DOCTOR'].includes(role));
    this.canViewPrices.set(['SUPERADMIN', 'ADMINISTRATIVE'].includes(role));
    this.isPatient.set(role === 'PATIENT');
  }

  ngOnInit() {
    this.loadLabResults();
    this.loadCatalog();
    this.loadPatients();
  }

  loadCatalog() {
    this.catalogService.getTests().subscribe(tests => this.catalogTests.set(tests));
  }

  loadPatients() {
    this.http.get<any>(`${API_URL}/patients`).subscribe(data => {
      const list = Array.isArray(data) ? data : (data.patients || []);
      this.patients.set(list);
    });
  }

  loadLabResults() {
    if (this.isPatient()) {
      const patientId = this.currentUser()?.Patient?.id;
      if (patientId) {
        this.medicalService.getPatientLabs(patientId).subscribe(data => {
          this.formatResults(data);
        });
      }
    } else {
      this.medicalService.getAllLabs().subscribe(data => {
        this.formatResults(data);
      });
    }
  }

  private formatResults(data: any[]) {
    const formatted = data.map(lab => {
      const patient = lab.Patient;
      const user = patient?.User;
      return {
        id: lab.id,
        patientName: user ? `${user.firstName} ${user.lastName}` : 'Paciente Externo',
        patientInitials: user ? (user.firstName[0] + user.lastName[0]) : 'PE',
        patientId: patient ? patient.documentId : 'N/A',
        testType: lab.testName,
        category: lab.category || 'Sangre',
        date: lab.createdAt,
        status: lab.status === 'Completed' || lab.status === 'Completado' ? 'Completado' : 'Pendiente',
        labOrder: lab.id.toString().substring(0, 8).toUpperCase(),
        price: lab.price
      };
    });
    this.allResults.set(formatted);
  }

  viewResult(result: any) {
    if (result.status !== 'Completado') {
      Swal.fire('Atención', 'El resultado aún no está disponible para visualizar.', 'warning');
      return;
    }
    const report = this.getMockReport(result);
    this.pdfService.viewPDF(report);
  }

  downloadResult(result: any) {
    if (result.status !== 'Completado') {
      Swal.fire('Atención', 'El resultado aún no está listo para descargar.', 'warning');
      return;
    }

    Swal.fire({
      title: 'Generando PDF',
      text: 'Por favor espere...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    setTimeout(() => {
      const report = this.getMockReport(result);
      this.pdfService.generatePDF(report);
      Swal.close();
    }, 500); 
  }

  private getMockReport(result: any): LabReport {
    const report: LabReport = {
      header: {
        labOrder: result.labOrder || '0000',
        patientName: result.patientName,
        ci: result.patientId.replace('V-', ''),
        sex: 'Masculino',
        age: 48,
        entryDate: new Date(result.date).toLocaleDateString('es-ES'),
        entryTime: '07:15:36 am',
        address: 'MONTALBAN',
        phone: '04241599101',
        printDate: new Date().toLocaleString('es-ES'),
        agreement: 'BANCO DE LA GENTE EMPRENDEDORA (BANGENTE)',
      },
      sections: []
    };

    if (result.testType.includes('Hematología')) {
      const hemItems = [...HEMATOLOGY_STRUCTURE];
      const items = hemItems.map(i => ({...i}));
      
      items[0].result = '5,26';
      items[1].result = '4,8';
      
      report.sections.push({
        title: 'HEMATOLOGIA',
        items: items
      });
    } else if (result.testType.includes('Lipídico') || result.testType.includes('Química')) {
      const chemItems = CHEMISTRY_STRUCTURE.map(i => ({...i}));
      
      chemItems[0].result = '97,6'; 
      chemItems[3].result = '239,0'; chemItems[3].isAbnormal = true;
      chemItems[4].result = '269,6'; chemItems[4].isAbnormal = true;

      report.sections.push({
        title: 'QUIMICA SANGUINEA',
        items: chemItems
      });

      report.sections.push({
        title: 'SEROLOGIA',
        items: [
          { description: 'VDRL', result: 'NO REACTIVO', units: '', referenceValues: 'AVC' }
        ]
      });
    } else {
      report.sections.push({
        title: 'RESULTADOS DE EXAMEN',
        items: [
          { description: 'Examen General', result: 'NORMAL', units: '-', referenceValues: '-' }
        ]
      });
    }

    return report;
  }

  uploadResult() {
    Swal.fire({
      title: 'Subir Resultado',
      html: `
        <div class="text-start">
          <label class="form-label small fw-bold">1. Seleccionar Paciente</label>
          <select id="swal-patient-id" class="form-select mb-3">
            <option value="">Seleccione...</option>
            ${this.patients().map(p => `<option value="${p.id}">${p.User.firstName} ${p.User.lastName}</option>`).join('')}
          </select>

          <label class="form-label small fw-bold">2. Tipo de Examen</label>
          <select id="swal-test-type" class="form-select mb-3">
            <option value="">Seleccione...</option>
            ${this.catalogTests().map(t => `<option value="${t.name}">${t.name} (${this.currencyService.formatAmount(t.price)})</option>`).join('')}
          </select>

          <label class="form-label small fw-bold">3. Cargar Archivo (PDF/Imágenes)</label>
          <input id="swal-lab-file" type="file" class="form-control mb-3">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Subir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      preConfirm: () => {
        const patientId = (document.getElementById('swal-patient-id') as HTMLSelectElement).value;
        const testName = (document.getElementById('swal-test-type') as HTMLSelectElement).value;
        const file = (document.getElementById('swal-lab-file') as HTMLInputElement).files?.[0];

        if (!patientId || !testName) {
          Swal.showValidationMessage('Complete los campos obligatorios');
          return false;
        }

        const selectedTest = this.catalogTests().find(t => t.name === testName);
        
        return {
          patientId,
          testName,
          category: selectedTest?.category || 'Sangre',
          price: selectedTest?.price || 0,
          status: 'Completed',
          notes: 'Resultado cargado manualmente'
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.medicalService.createLabResult(result.value).subscribe(() => {
          Swal.fire('¡Éxito!', 'El resultado se ha subido correctamente.', 'success');
          this.loadLabResults();
        });
      }
    });
  }
}
