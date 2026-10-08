import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { API_URL } from '../../api-config';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-hospital-ops',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hospital-ops.html',
  styleUrls: ['./hospital-ops.css']
})
export class HospitalOpsComponent implements OnInit {
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  activeTab = signal<'admissions' | 'triage' | 'beds' | 'surgeries'>('admissions');
  viewMode = signal<'list' | 'kanban'>('list');
  loading = signal<boolean>(true);

  // Common datasets
  patients = signal<any[]>([]);
  doctors = signal<any[]>([]);
  insuranceCompanies = signal<any[]>([]);

  // 1. Admissions State
  admissions = signal<any[]>([]);
  admissionSearch = signal<string>('');
  showAdmissionModal = false;
  showAdmissionDetailModal = false;
  showMoveAreaModal = false;
  selectedAdmissionDetail: any = null;
  selectedAdmissionForMove: any = null;

  // Selected patient in modal (read-only snapshot)
  selectedPatientForAdmission: any = null;

  // Form model for new admission
  currentAdmission: any = {
    admissionNumber: '',
    episodeNumber: '',
    patientId: '',
    medicalRecordNumber: '',
    attendingDoctorId: '',
    admissionType: 'HOSPITALIZATION', // ELECTIVE_SURGICAL, EMERGENCY, AMBULATORY, HOSPITALIZATION, SERVICE, CONSULTATION
    admissionDate: new Date().toISOString().split('T')[0],
    paymentType: 'PRIVATE',
    hasInsurance: false,
    insuranceCompanyId: '',
    insurancePolicyNumber: '',
    insurancePlan: '',
    insuranceHolderType: 'TITULAR',
    insuranceCoverageAmountUSD: 0.00,
    insuranceAuthorizationCode: '',
    insuranceClaimNumber: '',
    insuranceCartaAval: '',
    initialDiagnosis: '',
    initialArea: 'ADMISIÓN GENERAL',
    companionName: '',
    companionPhone: '',
    titularData: {
      fullName: '',
      documentType: 'CEDULA',
      documentPrefix: 'V',
      documentNumber: '',
      relationship: 'Titular',
      phone: '',
      email: '',
      address: ''
    },
    guarantorData: {
      fullName: '',
      documentType: 'CEDULA',
      documentPrefix: 'V',
      documentNumber: '',
      relationship: 'Familiar',
      phone: '',
      address: '',
      commitmentNotes: 'Se compromete formalmente como responsable financiero y garante de pago del episodio de admisión.'
    },
    insuredPatientData: {},
    notes: ''
  };

  // Form model for area movement
  moveAreaForm = {
    toArea: 'HOSPITALIZACIÓN',
    performedBy: '',
    authorizedBy: '',
    reason: '',
    notes: ''
  };

  // 2. Emergency Triage (RAC Manchester Protocol)
  triageRecords = signal<any[]>([]);
  showTriageModal = false;
  currentTriage: any = {
    patientId: null,
    triageLevel: 3,
    chiefComplaint: '',
    systolicBP: 120,
    diastolicBP: 80,
    heartRate: 75,
    respiratoryRate: 18,
    temperature: 36.5,
    oxygenSaturation: 98,
    glasgowScore: 15,
    painScale: 2,
    status: 'WAITING'
  };

  // 3. Hospital Beds
  beds = signal<any[]>([]);
  showBedModal = false;
  currentBed: any = {
    bedNumber: '',
    room: '',
    floor: 'Piso 1',
    ward: 'HOSPITALIZATION',
    dailyRateUSD: 100,
    status: 'AVAILABLE'
  };

  // 4. Surgeries
  surgeries = signal<any[]>([]);
  showSurgeryModal = false;
  currentSurgery: any = {
    surgeryNumber: '',
    patientId: null,
    leadSurgeonId: null,
    procedureName: '',
    operatingRoom: 'Quirófano 1',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledStartTime: '08:00',
    estimatedDurationMinutes: 120,
    anesthesiaType: 'GENERAL',
    status: 'SCHEDULED',
    preOpDiagnosis: ''
  };

  // Triage Levels helper
  triageLevels = [
    { level: 1, name: 'Nivel 1 - Resucitación (Rojo)', time: 'Atención Inmediata (0 min)', color: 'bg-danger text-white' },
    { level: 2, name: 'Nivel 2 - Emergencia (Naranja)', time: '10 a 15 min', color: 'bg-warning text-dark' },
    { level: 3, name: 'Nivel 3 - Urgencia (Amarillo)', time: '30 a 60 min', color: 'bg-warning-subtle text-dark border-warning' },
    { level: 4, name: 'Nivel 4 - Menor Urgencia (Verde)', time: '60 a 120 min', color: 'bg-success-subtle text-success' },
    { level: 5, name: 'Nivel 5 - No Urgente (Azul)', time: '120 a 240 min', color: 'bg-info-subtle text-info' }
  ];

  // Clinical Areas list for transfers
  hospitalAreas = [
    'EMERGENCIA / TRIAJE RAC',
    'TRAUMA SHOCK',
    'SALA DE OBSERVACIÓN',
    'PABELLÓN QUIRÚRGICO (QUIRÓFANO 1)',
    'PABELLÓN QUIRÚRGICO (QUIRÓFANO 2)',
    'SALA DE RECUPERACIÓN POST-ANESTÉSICA',
    'UNIDAD DE CUIDADOS INTENSIVOS (UCI)',
    'HOSPITALIZACIÓN PISO 1 (HAB. INDIVIDUAL)',
    'HOSPITALIZACIÓN PISO 2 (HAB. COMPARTIDA)',
    'PEDIATRÍA / RETÉN',
    'IMAGENOLOGÍA & RAYOS X',
    'LABORATORIO CLÍNICO',
    'ALTA MÉDICA / EGRESO'
  ];

  filteredAdmissions = computed(() => {
    const term = this.admissionSearch().toLowerCase();
    return this.admissions().filter(adm => {
      const num = (adm.admissionNumber || '').toLowerCase();
      const ep = (adm.episodeNumber || '').toLowerCase();
      const med = (adm.medicalRecordNumber || '').toLowerCase();
      const patName = `${adm.Patient?.User?.firstName || adm.patientDataSnapshot?.fullName || ''} ${adm.Patient?.User?.lastName || ''}`.toLowerCase();
      const diag = (adm.initialDiagnosis || '').toLowerCase();
      const area = (adm.currentArea || '').toLowerCase();
      const guarantor = (adm.guarantorData?.fullName || '').toLowerCase();

      return !term || num.includes(term) || ep.includes(term) || med.includes(term) || patName.includes(term) || diag.includes(term) || area.includes(term) || guarantor.includes(term);
    });
  });

  // Computed helper to check if patient has missing demographics
  hasMissingDemographics = computed(() => {
    const p = this.selectedPatientForAdmission;
    if (!p) return false;
    return !p.phone && !p.User?.phone || !p.address || !p.birthDate || !p.gender;
  });

  missingFieldsList = computed(() => {
    const p = this.selectedPatientForAdmission;
    if (!p) return [];
    const missing: string[] = [];
    if (!p.phone && !p.User?.phone) missing.push('Teléfono');
    if (!p.address) missing.push('Dirección de habitación');
    if (!p.birthDate) missing.push('Fecha de nacimiento');
    if (!p.gender) missing.push('Género');
    return missing;
  });

  ngOnInit() {
    this.loadInitialData();
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  loadInitialData() {
    this.loading.set(true);

    // Patients
    this.http.get<any>(`${API_URL}/patients`, { headers: this.getHeaders() }).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res.patients || []);
        this.patients.set(list);
      }
    });

    // Doctors
    this.http.get<any[]>('/api/doctors', { headers: this.getHeaders() }).subscribe({
      next: (res) => this.doctors.set(res || [])
    });

    // Insurance Companies
    this.http.get<any[]>('/api/insurance/companies', { headers: this.getHeaders() }).subscribe({
      next: (res) => this.insuranceCompanies.set(res || [])
    });

    this.loadAdmissions();
    this.loadTriage();
    this.loadBeds();
    this.loadSurgeries();
  }

  loadAdmissions() {
    this.http.get<any[]>('/api/hospital/admissions', { headers: this.getHeaders() }).subscribe({
      next: (res) => {
        this.admissions.set(res || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadTriage() {
    this.http.get<any[]>('/api/hospital/triage', { headers: this.getHeaders() }).subscribe({
      next: (res) => this.triageRecords.set(res || []),
      error: (err) => console.error(err)
    });
  }

  loadBeds() {
    this.http.get<any[]>('/api/hospital/beds', { headers: this.getHeaders() }).subscribe({
      next: (res) => this.beds.set(res || []),
      error: (err) => console.error(err)
    });
  }

  loadSurgeries() {
    this.http.get<any[]>('/api/hospital/surgeries', { headers: this.getHeaders() }).subscribe({
      next: (res) => this.surgeries.set(res || []),
      error: (err) => console.error(err)
    });
  }

  // ── ADMISSIONS MANAGEMENT ──────────────────────────
  openCreateAdmissionModal() {
    const year = new Date().getFullYear();
    const count = this.admissions().length + 1;
    const seq = String(count).padStart(5, '0');

    this.selectedPatientForAdmission = null;
    this.currentAdmission = {
      admissionNumber: `ADM-${year}-${seq}`,
      episodeNumber: `EP-${year}-${seq}`,
      patientId: '',
      medicalRecordNumber: '',
      attendingDoctorId: this.doctors()[0]?.id || '',
      admissionType: 'HOSPITALIZATION',
      admissionDate: new Date().toISOString().split('T')[0],
      paymentType: 'PRIVATE',
      hasInsurance: false,
      insuranceCompanyId: '',
      insurancePolicyNumber: '',
      insurancePlan: 'Cobertura Integral Hospitalaria',
      insuranceHolderType: 'TITULAR',
      insuranceCoverageAmountUSD: 0.00,
      insuranceAuthorizationCode: '',
      insuranceClaimNumber: '',
      insuranceCartaAval: '',
      initialDiagnosis: '',
      initialArea: 'ADMISIÓN GENERAL',
      companionName: '',
      companionPhone: '',
      titularData: {
        fullName: '',
        documentType: 'CEDULA',
        documentPrefix: 'V',
        documentNumber: '',
        relationship: 'Titular',
        phone: '',
        email: '',
        address: ''
      },
      guarantorData: {
        fullName: '',
        documentType: 'CEDULA',
        documentPrefix: 'V',
        documentNumber: '',
        relationship: 'Familiar',
        phone: '',
        address: '',
        commitmentNotes: 'Se compromete formalmente como responsable financiero y garante de pago del episodio de admisión.'
      },
      insuredPatientData: {},
      notes: ''
    };

    if (this.patients().length > 0) {
      this.onPatientSelectedForAdmission(this.patients()[0].id);
    }

    this.showAdmissionModal = true;
  }

  onPatientSelectedForAdmission(patientId: string) {
    if (!patientId) {
      this.selectedPatientForAdmission = null;
      return;
    }

    const patient = this.patients().find(p => p.id === patientId);
    if (patient) {
      this.selectedPatientForAdmission = patient;
      this.currentAdmission.patientId = patient.id;
      this.currentAdmission.medicalRecordNumber = patient.medicalRecordNumber || `HC-${patient.documentId}`;
      this.currentAdmission.hasInsurance = !!patient.hasInsurance;
      this.currentAdmission.paymentType = patient.hasInsurance ? 'INSURANCE' : 'PRIVATE';
      this.currentAdmission.insuranceCompanyId = patient.insuranceCompanyId || '';
      this.currentAdmission.insurancePolicyNumber = patient.policyNumber || '';

      // Prepopulate Titular with Patient data by default
      this.currentAdmission.titularData = {
        fullName: `${patient.User?.firstName || ''} ${patient.User?.lastName || ''}`.trim(),
        documentType: patient.documentType || 'CEDULA',
        documentPrefix: patient.documentPrefix || 'V',
        documentNumber: patient.documentNumber || (patient.documentId || '').replace(/[^0-9]/g, ''),
        relationship: 'Titular',
        phone: patient.phone || patient.User?.phone || '',
        email: patient.User?.email || '',
        address: patient.address || ''
      };

      // Prepopulate Guarantor with First Family Member or Patient by default
      if (patient.familyInfo && patient.familyInfo.length > 0) {
        const fam = patient.familyInfo[0];
        this.currentAdmission.guarantorData = {
          fullName: fam.fullName || '',
          documentType: 'CEDULA',
          documentPrefix: 'V',
          documentNumber: '',
          relationship: fam.relationship || 'Familiar',
          phone: fam.phone || '',
          address: patient.address || '',
          commitmentNotes: 'Se compromete formalmente como responsable financiero y garante de pago del episodio de admisión.'
        };
      }
    }
  }

  onGuarantorDocNumberInput(event: any) {
    const rawValue = event.target.value || '';
    this.currentAdmission.guarantorData.documentNumber = rawValue.replace(/[^0-9]/g, '');
  }

  onTitularDocNumberInput(event: any) {
    const rawValue = event.target.value || '';
    this.currentAdmission.titularData.documentNumber = rawValue.replace(/[^0-9]/g, '');
  }

  saveAdmission() {
    if (!this.currentAdmission.patientId || !this.currentAdmission.initialDiagnosis) {
      Swal.fire('Validación', 'Seleccione un paciente e ingrese el diagnóstico inicial de admisión', 'warning');
      return;
    }

    // Demographics validation check for non-emergency admissions
    if (this.currentAdmission.admissionType !== 'EMERGENCY' && this.hasMissingDemographics()) {
      Swal.fire({
        icon: 'error',
        title: 'Datos Demográficos Incompletos',
        text: `En admisiones no urgentes es obligatorio completar los datos demográficos del paciente. Faltan: ${this.missingFieldsList().join(', ')}.`
      });
      return;
    }

    this.http.post('/api/hospital/admissions', this.currentAdmission, { headers: this.getHeaders() }).subscribe({
      next: (res: any) => {
        let warningText = '';
        if (res.missingDemographicsWarning) {
          warningText = '\n⚠️ NOTA: Admisión de Emergencia registrada. Recuerde completar los datos demográficos faltantes posteriormente.';
        }

        Swal.fire({
          icon: 'success',
          title: '¡Admisión Registrada Exitosamente!',
          text: `Episodio ${res.admission?.episodeNumber || this.currentAdmission.episodeNumber} vinculado a la Historia Médica ${res.admission?.medicalRecordNumber || this.currentAdmission.medicalRecordNumber}.${warningText}`,
          confirmButtonColor: '#10b981'
        });
        this.showAdmissionModal = false;
        this.loadAdmissions();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al registrar admisión', 'error')
    });
  }

  openAdmissionDetailModal(admission: any) {
    this.selectedAdmissionDetail = admission;
    this.showAdmissionDetailModal = true;
  }

  // ── PATIENT AREA MOVEMENTS (TRAZABILIDAD Y CAMBIO DE ÁREA) ──
  openMoveAreaModal(admission: any) {
    this.selectedAdmissionForMove = admission;
    this.moveAreaForm = {
      toArea: 'PABELLÓN QUIRÚRGICO (QUIRÓFANO 1)',
      performedBy: 'Lcdo(a). Enfermero(a) de Guardia',
      authorizedBy: admission.Doctor ? `Dr(a). ${admission.Doctor.User?.firstName || ''} ${admission.Doctor.User?.lastName || ''}` : 'Médico Tratante / Guardia',
      reason: 'Traslado clínico para procedimiento / intervención',
      notes: ''
    };
    this.showMoveAreaModal = true;
  }

  submitAreaMovement() {
    if (!this.moveAreaForm.toArea) {
      Swal.fire('Atención', 'Seleccione el área de destino', 'warning');
      return;
    }

    const admId = this.selectedAdmissionForMove.id;
    this.http.post(`/api/hospital/admissions/${admId}/move-area`, this.moveAreaForm, { headers: this.getHeaders() }).subscribe({
      next: (res: any) => {
        Swal.fire({
          icon: 'success',
          title: '¡Cambio de Área Registrado!',
          text: `El paciente ha sido trasladado exitosamente a: ${this.moveAreaForm.toArea}. Se ha registrado la traza de auditoría.`,
          confirmButtonColor: '#10b981'
        });
        this.showMoveAreaModal = false;
        this.loadAdmissions();
        if (this.selectedAdmissionDetail && this.selectedAdmissionDetail.id === admId) {
          this.selectedAdmissionDetail.currentArea = res.currentArea;
          this.selectedAdmissionDetail.areaMovements = res.areaMovements;
        }
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al registrar cambio de área', 'error')
    });
  }

  // ── DISCHARGE ADMISSION (ALTA MÉDICA Y ADMINISTRATIVA) ──
  dischargeAdmission(admission: any) {
    if (admission.status === 'DISCHARGED' || admission.status === 'CLOSED') {
      Swal.fire('Información', 'Esta admisión ya se encuentra con Alta Médica y Administrativa (Cerrada / Inmutable).', 'info');
      return;
    }

    Swal.fire({
      title: 'Alta Médica y Administrativa',
      html: `
        <div class="text-start">
          <p class="small text-muted mb-2">Se procederá a dar de alta al paciente <strong>${admission.Patient?.User?.firstName || admission.patientDataSnapshot?.fullName || 'Paciente'}</strong>, liberando camas ocupadas y cerrando el episodio clínico.</p>
          <div class="mb-3">
            <label class="form-label small fw-bold">Médico que Autoriza el Alta:</label>
            <input id="swal-auth-doc" class="form-control form-control-sm" value="${admission.Doctor ? 'Dr(a). ' + (admission.Doctor.User?.firstName || '') + ' ' + (admission.Doctor.User?.lastName || '') : 'Dr. Médico Tratante'}">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-bold">Responsable del Trámite Administrativo:</label>
            <input id="swal-admin-user" class="form-control form-control-sm" value="Recepción / Admisión y Facturación">
          </div>
          <div class="mb-2">
            <label class="form-label small fw-bold">Epicrisis / Resumen de Egreso y Diagnóstico Final:</label>
            <textarea id="swal-discharge-notes" class="form-control form-control-sm" rows="3" placeholder="Evolución clínica satisfactoria, indicaciones post-operatorias o tratamiento ambulatorio..."></textarea>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar Alta y Cerrar Episodio',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const authorizedBy = (document.getElementById('swal-auth-doc') as HTMLInputElement)?.value;
        const performedBy = (document.getElementById('swal-admin-user') as HTMLInputElement)?.value;
        const dischargeNotes = (document.getElementById('swal-discharge-notes') as HTMLTextAreaElement)?.value;
        if (!dischargeNotes) {
          Swal.showValidationMessage('Debe ingresar un resumen o nota de egreso del paciente');
          return false;
        }
        return { authorizedBy, performedBy, dischargeNotes };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.http.post(`/api/hospital/admissions/${admission.id}/discharge`, result.value, { headers: this.getHeaders() }).subscribe({
          next: (res: any) => {
            Swal.fire({
              icon: 'success',
              title: '¡Alta Concedida con Éxito!',
              text: `El episodio ${admission.episodeNumber} ha sido cerrado y registrado como inmutable.`,
              confirmButtonColor: '#10b981'
            });
            this.showAdmissionDetailModal = false;
            this.loadAdmissions();
            this.loadBeds();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'Error al procesar el alta', 'error')
        });
      }
    });
  }

  getAdmissionTypeLabel(type: string): string {
    const map: Record<string, string> = {
      ELECTIVE_SURGICAL: 'Electivo / Quirúrgico',
      EMERGENCY: 'Emergencia',
      AMBULATORY: 'Ambulatorio',
      HOSPITALIZATION: 'Hospitalización General',
      SERVICE: 'Servicio Clínico',
      CONSULTATION: 'Consulta Médica'
    };
    return map[type] || type || 'Hospitalización';
  }

  getAdmissionsByStage(stage: string): any[] {
    const list = this.filteredAdmissions();
    if (stage === 'ADMISSION') {
      return list.filter(a => a.status === 'ADMITTED' && (!a.currentArea || a.currentArea.includes('ADMISIÓN') || a.currentArea.includes('EXTERIOR')));
    }
    if (stage === 'EMERGENCY') {
      return list.filter(a => a.currentArea?.includes('EMERGENCIA') || a.currentArea?.includes('TRAUMA') || a.currentArea?.includes('TRIAJE') || a.currentArea?.includes('OBSERVACIÓN'));
    }
    if (stage === 'SURGERY_ICU') {
      return list.filter(a => a.currentArea?.includes('QUIRÓFANO') || a.currentArea?.includes('PABELLÓN') || a.currentArea?.includes('UCI') || a.currentArea?.includes('RECUPERACIÓN'));
    }
    if (stage === 'HOSPITALIZATION') {
      return list.filter(a => a.status === 'ADMITTED' && (a.currentArea?.includes('HOSPITALIZACIÓN') || a.currentArea?.includes('PISO') || a.currentArea?.includes('PEDIATRÍA')));
    }
    if (stage === 'DISCHARGED') {
      return list.filter(a => a.status === 'DISCHARGED' || a.currentArea?.includes('ALTA') || a.currentArea?.includes('EGRESO'));
    }
    return [];
  }

  // --- TRIAGE ---
  openCreateTriageModal() {
    this.currentTriage = {
      patientId: this.patients()[0]?.id || null,
      triageLevel: 3,
      chiefComplaint: '',
      systolicBP: 120,
      diastolicBP: 80,
      heartRate: 75,
      respiratoryRate: 18,
      temperature: 36.5,
      oxygenSaturation: 98,
      glasgowScore: 15,
      painScale: 2,
      status: 'WAITING'
    };
    this.showTriageModal = true;
  }

  saveTriage() {
    if (!this.currentTriage.patientId || !this.currentTriage.chiefComplaint) {
      Swal.fire('Validación', 'Seleccione paciente e ingrese el motivo de consulta', 'warning');
      return;
    }

    this.http.post('/api/hospital/triage', this.currentTriage, { headers: this.getHeaders() }).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Evaluación de triaje registrada', 'success');
        this.showTriageModal = false;
        this.loadTriage();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al registrar triaje', 'error')
    });
  }

  // --- BEDS ---
  openCreateBedModal() {
    this.currentBed = {
      bedNumber: `CAMA-${Math.floor(100 + Math.random() * 900)}`,
      room: '101',
      floor: 'Piso 1',
      ward: 'HOSPITALIZATION',
      dailyRateUSD: 120,
      status: 'AVAILABLE'
    };
    this.showBedModal = true;
  }

  saveBed() {
    this.http.post('/api/hospital/beds', this.currentBed, { headers: this.getHeaders() }).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Cama registrada correctamente', 'success');
        this.showBedModal = false;
        this.loadBeds();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar cama', 'error')
    });
  }

  toggleBedStatus(bed: any, status: string) {
    this.http.put(`/api/hospital/beds/${bed.id}`, { status }, { headers: this.getHeaders() }).subscribe({
      next: () => {
        bed.status = status;
        Swal.fire('Actualizado', `Cama ${bed.bedNumber} marcada como ${status}`, 'success');
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al cambiar estado', 'error')
    });
  }

  // --- SURGERIES ---
  openCreateSurgeryModal() {
    this.currentSurgery = {
      surgeryNumber: `QX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      patientId: this.patients()[0]?.id || null,
      leadSurgeonId: this.doctors()[0]?.id || null,
      procedureName: '',
      operatingRoom: 'Quirófano 1',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledStartTime: '08:00',
      estimatedDurationMinutes: 120,
      anesthesiaType: 'GENERAL',
      status: 'SCHEDULED',
      preOpDiagnosis: ''
    };
    this.showSurgeryModal = true;
  }

  saveSurgery() {
    this.http.post('/api/hospital/surgeries', this.currentSurgery, { headers: this.getHeaders() }).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Cirugía programada exitosamente', 'success');
        this.showSurgeryModal = false;
        this.loadSurgeries();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al programar cirugía', 'error')
    });
  }

  updateSurgeryStatus(sx: any, status: string) {
    this.http.put(`/api/hospital/surgeries/${sx.id}/status`, { status }, { headers: this.getHeaders() }).subscribe({
      next: () => {
        sx.status = status;
        Swal.fire('Cirugía Actualizada', `Estado: ${status}`, 'success');
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al actualizar cirugía', 'error')
    });
  }
}
