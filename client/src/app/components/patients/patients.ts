import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { LanguageService } from '../../services/language.service';
import { ExportService } from '../../services/export.service';
import { AuthService } from '../../services/auth.service';
import { API_URL } from '../../api-config';
import { TranslatePipe } from '../../services/translate.pipe';

interface FamilyMember {
  fullName: string;
  relationship: string;
  phone: string;
  isEmergencyContact: boolean;
}

interface Beneficiary {
  fullName: string;
  documentType: string;
  documentPrefix: string;
  documentNumber: string;
  relationship: string;
  birthDate: string;
  phone: string;
}

interface DiseaseItem {
  diseaseName: string;
  diagnosisDate: string;
  treatment: string;
  notes: string;
}

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  templateUrl: './patients.html',
  styleUrl: './patients.css',
})
export class Patients implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  public langService = inject(LanguageService);
  private exportService = inject(ExportService);
  public authService = inject(AuthService);

  patients = signal<any[]>([]);
  insuranceCompanies = signal<any[]>([]);
  loading = signal<boolean>(true);
  searchTerm = signal('');
  genderFilter = signal('all');
  insuranceFilter = signal('all');
  showAdvancedFilters = signal(false);
  viewMode = signal<'list' | 'kanban'>('list');

  // Modal State
  showPatientModal = false;
  showDetailModal = false;
  selectedPatientDetail: any = null;
  activeModalTab: 'basic' | 'insurance' | 'family' | 'beneficiaries' | 'clinical' = 'basic';
  isEditing = false;
  editingPatientId: string | null = null;

  // Patient Form Model
  patientForm = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    documentType: 'CEDULA' as 'CEDULA' | 'PASAPORTE' | 'RIF',
    documentPrefix: 'V',
    documentNumber: '',
    birthDate: '',
    gender: 'Male',
    phone: '',
    state: 'Distrito Capital',
    city: 'Caracas',
    municipality: 'Libertador',
    address: '',
    bloodType: 'O+',
    allergies: '',
    hasInsurance: false,
    insuranceCompanyId: '',
    insuranceProvider: 'Particular',
    policyNumber: '',
    copayPercentage: 0,
    familyInfo: [] as FamilyMember[],
    beneficiaries: [] as Beneficiary[],
    preexistingDiseases: [] as DiseaseItem[],
    clinicalHistorySummary: ''
  };

  // Computed live medical record number preview
  previewMedicalRecord = computed(() => {
    const pref = this.patientForm.documentPrefix || 'V';
    const num = this.patientForm.documentNumber || '00000000';
    return `HC-${pref}${num}`;
  });

  filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const gender = this.genderFilter();
    const insFilter = this.insuranceFilter();
    
    return this.patients().filter(p => {
      const name = `${p.User?.firstName || ''} ${p.User?.lastName || ''}`.toLowerCase();
      const doc = (p.documentId || '').toLowerCase();
      const medRec = (p.medicalRecordNumber || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      
      const matchesSearch = !term || name.includes(term) || doc.includes(term) || medRec.includes(term) || phone.includes(term);
      const matchesGender = gender === 'all' || p.gender === gender;
      const matchesInsurance = insFilter === 'all' || 
        (insFilter === 'insured' && p.hasInsurance) ||
        (insFilter === 'particular' && !p.hasInsurance);
      
      return matchesSearch && matchesGender && matchesInsurance;
    });
  });

  insuredPatients = computed(() => this.filteredPatients().filter(p => p.hasInsurance));
  particularPatients = computed(() => this.filteredPatients().filter(p => !p.hasInsurance));

  ngOnInit() {
    this.loadPatients();
    this.loadInsuranceCompanies();
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  loadPatients() {
    this.loading.set(true);
    this.http.get<any>(`${API_URL}/patients`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : (data.patients || []);
          this.patients.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  loadInsuranceCompanies() {
    this.http.get<any[]>(`${API_URL}/insurance/companies`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => this.insuranceCompanies.set(data || [])
      });
  }

  // ── Document Number Sanitation (Strictly digits only) ──
  onDocumentNumberInput(event: any) {
    const rawValue = event.target.value || '';
    const cleanValue = rawValue.replace(/[^0-9]/g, '');
    this.patientForm.documentNumber = cleanValue;
  }

  onDocumentTypeChange(newType: 'CEDULA' | 'PASAPORTE' | 'RIF') {
    this.patientForm.documentType = newType;
    if (newType === 'CEDULA') {
      this.patientForm.documentPrefix = 'V';
    } else if (newType === 'PASAPORTE') {
      this.patientForm.documentPrefix = 'PAS';
    } else if (newType === 'RIF') {
      this.patientForm.documentPrefix = 'J';
    }
  }

  // ── Modals & Actions ──
  openNewPatientModal() {
    this.isEditing = false;
    this.editingPatientId = null;
    this.activeModalTab = 'basic';
    this.patientForm = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      documentType: 'CEDULA',
      documentPrefix: 'V',
      documentNumber: '',
      birthDate: '',
      gender: 'Male',
      phone: '',
      state: 'Distrito Capital',
      city: 'Caracas',
      municipality: 'Libertador',
      address: '',
      bloodType: 'O+',
      allergies: '',
      hasInsurance: false,
      insuranceCompanyId: '',
      insuranceProvider: 'Particular',
      policyNumber: '',
      copayPercentage: 0,
      familyInfo: [],
      beneficiaries: [],
      preexistingDiseases: [],
      clinicalHistorySummary: ''
    };
    this.showPatientModal = true;
  }

  openEditPatientModal(patient: any) {
    this.isEditing = true;
    this.editingPatientId = patient.id;
    this.activeModalTab = 'basic';
    
    // Extract prefix and number
    let pref = patient.documentPrefix || 'V';
    let num = patient.documentNumber;
    if (!num && patient.documentId) {
      num = patient.documentId.replace(/[^0-9]/g, '');
      if (patient.documentId.startsWith('PAS')) pref = 'PAS';
      else if (patient.documentId.startsWith('E')) pref = 'E';
      else if (patient.documentId.startsWith('J')) pref = 'J';
      else if (patient.documentId.startsWith('G')) pref = 'G';
      else if (patient.documentId.startsWith('C')) pref = 'C';
      else if (patient.documentId.startsWith('P')) pref = 'P';
      else pref = 'V';
    }

    this.patientForm = {
      firstName: patient.User?.firstName || '',
      lastName: patient.User?.lastName || '',
      email: patient.User?.email || '',
      password: '',
      documentType: patient.documentType || (pref === 'PAS' ? 'PASAPORTE' : (['J', 'G', 'C', 'P'].includes(pref) ? 'RIF' : 'CEDULA')),
      documentPrefix: pref,
      documentNumber: num || '',
      birthDate: patient.birthDate || '',
      gender: patient.gender || 'Male',
      phone: patient.phone || patient.User?.phone || '',
      state: patient.state || 'Distrito Capital',
      city: patient.city || 'Caracas',
      municipality: patient.municipality || 'Libertador',
      address: patient.address || '',
      bloodType: patient.bloodType || 'O+',
      allergies: patient.allergies || '',
      hasInsurance: !!patient.hasInsurance,
      insuranceCompanyId: patient.insuranceCompanyId || '',
      insuranceProvider: patient.insuranceProvider || 'Particular',
      policyNumber: patient.policyNumber || '',
      copayPercentage: patient.copayPercentage || 0,
      familyInfo: Array.isArray(patient.familyInfo) ? [...patient.familyInfo] : [],
      beneficiaries: Array.isArray(patient.beneficiaries) ? [...patient.beneficiaries] : [],
      preexistingDiseases: Array.isArray(patient.preexistingDiseases) ? [...patient.preexistingDiseases] : [],
      clinicalHistorySummary: patient.clinicalHistorySummary || ''
    };

    this.showPatientModal = true;
  }

  openDetailModal(patient: any) {
    this.selectedPatientDetail = patient;
    this.showDetailModal = true;
  }

  // ── Dynamic Rows Helpers ──
  addFamilyMember() {
    this.patientForm.familyInfo.push({
      fullName: '',
      relationship: 'Cónyuge',
      phone: '',
      isEmergencyContact: true
    });
  }

  removeFamilyMember(index: number) {
    this.patientForm.familyInfo.splice(index, 1);
  }

  addBeneficiary() {
    this.patientForm.beneficiaries.push({
      fullName: '',
      documentType: 'CEDULA',
      documentPrefix: 'V',
      documentNumber: '',
      relationship: 'Hijo(a)',
      birthDate: '',
      phone: ''
    });
  }

  removeBeneficiary(index: number) {
    this.patientForm.beneficiaries.splice(index, 1);
  }

  addDisease() {
    this.patientForm.preexistingDiseases.push({
      diseaseName: '',
      diagnosisDate: '',
      treatment: '',
      notes: ''
    });
  }

  removeDisease(index: number) {
    this.patientForm.preexistingDiseases.splice(index, 1);
  }

  // ── Save / Update Patient ──
  savePatient() {
    if (!this.patientForm.firstName || !this.patientForm.lastName || !this.patientForm.documentNumber) {
      Swal.fire('Atención', 'Nombres, apellidos y número de documento son obligatorios.', 'warning');
      return;
    }

    const payload = {
      ...this.patientForm,
      documentNumber: this.patientForm.documentNumber.replace(/[^0-9]/g, ''),
      documentId: `${this.patientForm.documentPrefix}${this.patientForm.documentNumber.replace(/[^0-9]/g, '')}`
    };

    if (this.isEditing && this.editingPatientId) {
      this.http.put(`${API_URL}/patients/${this.editingPatientId}`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: () => {
            Swal.fire('¡Éxito!', 'Paciente actualizado correctamente.', 'success');
            this.showPatientModal = false;
            this.loadPatients();
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo actualizar el paciente.', 'error');
          }
        });
    } else {
      this.http.post(`${API_URL}/patients`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: '¡Paciente Registrado con Éxito!',
              text: `Historia Médica asignada: ${this.previewMedicalRecord()}`,
              confirmButtonColor: '#10b981'
            });
            this.showPatientModal = false;
            this.loadPatients();
          },
          error: (err) => {
            Swal.fire('Error al Registrar', err.error?.message || 'Verifica los datos ingresados.', 'error');
          }
        });
    }
  }

  deletePatient(id: string) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará al paciente y todos sus registros clínicos asociados.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${API_URL}/patients/${id}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.loadPatients();
              Swal.fire('Eliminado', 'El paciente ha sido borrado del sistema.', 'success');
            },
            error: () => {
              Swal.fire('Error', 'No se pudo eliminar al paciente', 'error');
            }
          });
      }
    });
  }

  viewHistory(id: string) {
    this.router.navigate(['/history'], { queryParams: { id } });
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.set(!this.showAdvancedFilters());
  }

  clearFilters() {
    this.searchTerm.set('');
    this.genderFilter.set('all');
    this.insuranceFilter.set('all');
  }

  exportReport() {
    if (this.filteredPatients().length === 0) {
      Swal.fire('Atención', 'No hay datos para exportar', 'warning');
      return;
    }

    const headers = ['Nº Historia Médica', 'Paciente', 'C.I. / Documento', 'Seguro', 'Teléfono', 'Género'];
    const rows = this.filteredPatients().map(p => [
      p.medicalRecordNumber || `HC-${p.documentId}`,
      `${p.User?.firstName} ${p.User?.lastName}`,
      p.documentId,
      p.hasInsurance ? (p.InsuranceCompany?.name || p.insuranceProvider) : 'Particular',
      p.phone || p.User?.phone || 'N/A',
      p.gender === 'Male' ? 'Masculino' : (p.gender === 'Female' ? 'Femenino' : 'Otro')
    ]);

    Swal.fire({
      title: 'Exportar Listado de Pacientes',
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
      const filename = `Listado_Pacientes_ClinicaSaaS_${new Date().toISOString().split('T')[0]}`;
      const title = 'Listado Oficial de Pacientes e Historias Médicas';
      const user = this.authService.currentUser();
      const branding = {
        name: user?.businessName || 'Clínica SaaS Internacional',
        professional: user ? `${user.firstName} ${user.lastName}` : undefined,
        tagline: 'Sistema Médico Hospitalario y Control de Historias Clínicas'
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
