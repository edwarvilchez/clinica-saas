import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { API_URL } from '../../api-config';
import Swal from 'sweetalert2';

interface ClaimItem {
  description: string;
  code: string;
  category: string;
  quantity: number;
  unitPriceUSD: number;
  totalUSD: number;
}

@Component({
  selector: 'app-insurance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './insurance.html',
  styleUrls: ['./insurance.css']
})
export class InsuranceComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  companies = signal<any[]>([]);
  policies = signal<any[]>([]);
  claims = signal<any[]>([]);
  patients = signal<any[]>([]);
  doctors = signal<any[]>([]);

  loading = signal<boolean>(true);
  activeTab = signal<'companies' | 'policies' | 'claims'>('claims');
  viewMode = signal<'list' | 'kanban'>('list');
  searchTerm = signal<string>('');

  // Filters for claims
  claimStatusFilter = signal<string>('ALL');
  claimCompanyFilter = signal<string>('ALL');
  claimStartDateFilter = signal<string>('');
  claimEndDateFilter = signal<string>('');

  // Modal States
  showCompanyModal = false;
  showPolicyModal = false;
  showClaimModal = false;
  showVoucherPreviewModal = false;
  selectedClaimForPreview: any = null;

  currentCompany: any = {
    name: '',
    rif: '',
    phone: '',
    email: '',
    contactPerson: '',
    defaultCoveragePercent: 80,
    paymentTermDays: 30,
    notes: ''
  };

  currentPolicy: any = {
    patientId: '',
    insuranceCompanyId: '',
    policyNumber: '',
    certificateNumber: '',
    holderName: '',
    relationship: 'Titular',
    coveragePercent: 80,
    deductibleUSD: 0.00,
    expirationDate: ''
  };

  newClaim: {
    insuranceCompanyId: string;
    patientId: string;
    doctorId: string;
    policyNumber: string;
    authorizationCode: string;
    serviceType: string;
    serviceStartDate: string;
    serviceEndDate: string;
    diagnosis: string;
    items: ClaimItem[];
    deductibleUSD: number;
    notes: string;
  } = {
    insuranceCompanyId: '',
    patientId: '',
    doctorId: '',
    policyNumber: '',
    authorizationCode: '',
    serviceType: 'CONSULTATION',
    serviceStartDate: new Date().toISOString().split('T')[0],
    serviceEndDate: new Date().toISOString().split('T')[0],
    diagnosis: '',
    items: [],
    deductibleUSD: 0,
    notes: ''
  };

  // Computeds for filtering
  filteredCompanies = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.companies().filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.rif?.toLowerCase().includes(term) ||
      c.contactPerson?.toLowerCase().includes(term)
    );
  });

  filteredPolicies = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.policies().filter(p =>
      p.policyNumber?.toLowerCase().includes(term) ||
      p.holderName?.toLowerCase().includes(term) ||
      p.InsuranceCompany?.name?.toLowerCase().includes(term) ||
      p.Patient?.User?.firstName?.toLowerCase().includes(term) ||
      p.Patient?.User?.lastName?.toLowerCase().includes(term)
    );
  });

  filteredClaims = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.claimStatusFilter();
    const companyId = this.claimCompanyFilter();
    const start = this.claimStartDateFilter();
    const end = this.claimEndDateFilter();

    return this.claims().filter(c => {
      const matchTerm = !term || 
        c.claimNumber?.toLowerCase().includes(term) ||
        c.authorizationCode?.toLowerCase().includes(term) ||
        c.policyNumber?.toLowerCase().includes(term) ||
        c.Patient?.User?.firstName?.toLowerCase().includes(term) ||
        c.Patient?.User?.lastName?.toLowerCase().includes(term) ||
        c.InsuranceCompany?.name?.toLowerCase().includes(term);

      const matchStatus = status === 'ALL' || c.status === status;
      const matchCompany = companyId === 'ALL' || c.insuranceCompanyId === companyId;

      let matchDates = true;
      if (start && c.serviceStartDate < start) matchDates = false;
      if (end && c.serviceEndDate > end) matchDates = false;

      return matchTerm && matchStatus && matchCompany && matchDates;
    });
  });

  // Summary Metrics
  totalClaimsCount = computed(() => this.claims().length);

  totalClaimedUSD = computed(() => {
    return this.claims().reduce((acc, c) => acc + parseFloat(c.claimedAmountUSD || 0), 0);
  });

  totalApprovedUSD = computed(() => {
    return this.claims()
      .filter(c => c.status === 'APPROVED' || c.status === 'PAID')
      .reduce((acc, c) => acc + parseFloat(c.claimedAmountUSD || 0), 0);
  });

  totalPendingUSD = computed(() => {
    return this.claims()
      .filter(c => c.status === 'EMITTED' || c.status === 'UNDER_REVIEW')
      .reduce((acc, c) => acc + parseFloat(c.claimedAmountUSD || 0), 0);
  });

  getClaimsByStage(stage: string): any[] {
    return this.filteredClaims().filter(c => (c.status || 'DRAFT') === stage);
  }

  getClaimsStageTotalUSD(stage: string): number {
    return this.getClaimsByStage(stage).reduce((acc, c) => acc + parseFloat(c.claimedAmountUSD || 0), 0);
  }

  ngOnInit() {
    this.loadData();
    this.loadPatientsAndDoctors();
  }

  loadData() {
    this.loading.set(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch Companies
    this.http.get<any[]>('/api/insurance/companies', { headers }).subscribe({
      next: (comp) => {
        this.companies.set(comp);
      }
    });

    // Fetch Policies
    this.http.get<any[]>('/api/insurance/policies', { headers }).subscribe({
      next: (pol) => {
        this.policies.set(pol);
      }
    });

    // Fetch Claims
    this.http.get<any[]>('/api/insurance/claims', { headers }).subscribe({
      next: (cl) => {
        this.claims.set(cl);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadPatientsAndDoctors() {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    this.http.get<any[]>('/api/patients', { headers }).subscribe({
      next: (data) => this.patients.set(data || [])
    });

    this.http.get<any[]>('/api/doctors', { headers }).subscribe({
      next: (data) => this.doctors.set(data || [])
    });
  }

  // ── Modals & Claim Setup ───────────────────
  openCompanyModal() {
    this.currentCompany = {
      name: '',
      rif: 'J-',
      phone: '+58 ',
      email: '',
      contactPerson: '',
      defaultCoveragePercent: 80,
      paymentTermDays: 30,
      notes: ''
    };
    this.showCompanyModal = true;
  }

  saveCompany() {
    if (!this.currentCompany.name || !this.currentCompany.rif) {
      Swal.fire('Atención', 'Nombre y RIF son obligatorios', 'warning');
      return;
    }

    const token = localStorage.getItem('token');
    this.http.post('/api/insurance/companies', this.currentCompany, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Aseguradora registrada correctamente', 'success');
        this.showCompanyModal = false;
        this.loadData();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar', 'error')
    });
  }

  openPolicyModal() {
    this.currentPolicy = {
      patientId: '',
      insuranceCompanyId: '',
      policyNumber: '',
      certificateNumber: '',
      holderName: '',
      relationship: 'Titular',
      coveragePercent: 80,
      deductibleUSD: 0.00,
      expirationDate: ''
    };
    this.showPolicyModal = true;
  }

  savePolicy() {
    if (!this.currentPolicy.patientId || !this.currentPolicy.insuranceCompanyId || !this.currentPolicy.policyNumber) {
      Swal.fire('Atención', 'Paciente, aseguradora y número de póliza son requeridos', 'warning');
      return;
    }

    const token = localStorage.getItem('token');
    this.http.post('/api/insurance/policies', this.currentPolicy, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Póliza asignada correctamente al paciente', 'success');
        this.showPolicyModal = false;
        this.loadData();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar póliza', 'error')
    });
  }

  openClaimModal() {
    const today = new Date().toISOString().split('T')[0];
    this.newClaim = {
      insuranceCompanyId: '',
      patientId: '',
      doctorId: '',
      policyNumber: '',
      authorizationCode: '',
      serviceType: 'CONSULTATION',
      serviceStartDate: today,
      serviceEndDate: today,
      diagnosis: '',
      items: [
        {
          description: 'Consulta Médica Especializada y Evaluación Clínica',
          code: 'CONS-01',
          category: 'CONSULTATION',
          quantity: 1,
          unitPriceUSD: 50.00,
          totalUSD: 50.00
        }
      ],
      deductibleUSD: 0,
      notes: ''
    };
    this.showClaimModal = true;
  }

  onPatientChanged(patientId: string) {
    if (!patientId) return;
    const policy = this.policies().find(p => p.patientId === patientId);
    if (policy) {
      this.newClaim.insuranceCompanyId = policy.insuranceCompanyId;
      this.newClaim.policyNumber = policy.policyNumber;
      this.newClaim.deductibleUSD = parseFloat(policy.deductibleUSD || 0);
    }
  }

  addClaimItem() {
    this.newClaim.items.push({
      description: '',
      code: 'SERV-' + (this.newClaim.items.length + 1),
      category: 'SERVICE',
      quantity: 1,
      unitPriceUSD: 0,
      totalUSD: 0
    });
  }

  removeClaimItem(index: number) {
    this.newClaim.items.splice(index, 1);
  }

  updateItemTotal(item: ClaimItem) {
    item.totalUSD = (item.quantity || 1) * (item.unitPriceUSD || 0);
  }

  getGrossAmountUSD(): number {
    return this.newClaim.items.reduce((acc, it) => acc + (parseFloat(it.totalUSD as any) || 0), 0);
  }

  getClaimedAmountUSD(): number {
    const gross = this.getGrossAmountUSD();
    const ded = parseFloat(this.newClaim.deductibleUSD as any) || 0;
    return Math.max(0, gross - ded);
  }

  saveClaim() {
    if (!this.newClaim.insuranceCompanyId || !this.newClaim.patientId || !this.newClaim.serviceStartDate || !this.newClaim.serviceEndDate) {
      Swal.fire('Atención', 'Por favor complete la aseguradora, paciente y rango de fechas.', 'warning');
      return;
    }

    if (this.newClaim.items.length === 0) {
      Swal.fire('Atención', 'Debe agregar al menos un concepto o servicio al reclamo.', 'warning');
      return;
    }

    const payload = {
      ...this.newClaim,
      grossAmountUSD: this.getGrossAmountUSD(),
      deductibleUSD: this.newClaim.deductibleUSD || 0,
      claimedAmountUSD: this.getClaimedAmountUSD(),
      bcvRate: this.currencyService.rate || 45.50
    };

    const token = localStorage.getItem('token');
    this.http.post('/api/insurance/claims', payload, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (createdClaim: any) => {
        Swal.fire({
          icon: 'success',
          title: '¡Reclamo Registrado con Éxito!',
          text: `Se generó el siniestro ${createdClaim.claimNumber}. Puedes imprimir el comprobante de inmediato.`,
          confirmButtonText: 'Ver Comprobante',
          showCancelButton: true,
          cancelButtonText: 'Cerrar'
        }).then((result) => {
          this.showClaimModal = false;
          this.loadData();
          if (result.isConfirmed) {
            this.openVoucherPreview(createdClaim);
          }
        });
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al registrar el reclamo', 'error')
    });
  }

  updateStatus(claim: any, newStatus: string) {
    const token = localStorage.getItem('token');
    this.http.put(`/api/insurance/claims/${claim.id}/status`, { status: newStatus }, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (updated: any) => {
        claim.status = updated.status;
        Swal.fire('Estado Actualizado', `El reclamo ${claim.claimNumber} ahora está en estado: ${this.getStatusLabel(newStatus)}`, 'success');
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al actualizar estado', 'error')
    });
  }

  deleteClaim(claim: any) {
    Swal.fire({
      title: '¿Eliminar Reclamo?',
      text: `Se eliminará el siniestro ${claim.claimNumber}. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        const token = localStorage.getItem('token');
        this.http.delete(`/api/insurance/claims/${claim.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Reclamo eliminado correctamente', 'success');
            this.loadData();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'Error al eliminar', 'error')
        });
      }
    });
  }

  openVoucherPreview(claim: any) {
    const token = claim.claimToken;
    this.http.get<any>(`/api/insurance/claims/voucher/${token}`).subscribe({
      next: (data) => {
        this.selectedClaimForPreview = data;
        this.showVoucherPreviewModal = true;
      },
      error: () => {
        this.router.navigate(['/insurance-claim-voucher', claim.claimToken]);
      }
    });
  }

  copyPublicLink(claim: any) {
    const url = `${window.location.origin}/insurance-claim-voucher/${claim.claimToken}`;
    navigator.clipboard.writeText(url).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Enlace Copiado',
        text: 'El enlace del comprobante oficial ha sido copiado al portapapeles.',
        timer: 2000,
        showConfirmButton: false
      });
    });
  }

  // Formatting helpers
  formatDate(d: string): string {
    if (!d) return 'N/A';
    const date = new Date(d);
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatUSD(amount: any): string {
    const val = parseFloat(amount || 0);
    return `$ ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatVES(amountUSD: any, bcvRate?: any): string {
    const usd = parseFloat(amountUSD || 0);
    const rate = parseFloat(bcvRate || this.currencyService.rate || 1.0);
    const ves = usd * rate;
    return `Bs. ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  getServiceTypeLabel(type: string): string {
    const map: Record<string, { es: string, en: string }> = {
      CONSULTATION: { es: 'Consulta Médica', en: 'Consultation' },
      SURGERY: { es: 'Cirugía / Pabellón', en: 'Surgery' },
      HOSPITALIZATION: { es: 'Hospitalización', en: 'Hospitalization' },
      PROCEDURE: { es: 'Procedimiento Clínico', en: 'Procedure' },
      EMERGENCY: { es: 'Emergencia / Triaje', en: 'Emergency' },
      LAB_IMAGING: { es: 'Laboratorio / Imágenes', en: 'Lab & Imaging' },
      OTHER: { es: 'Otros Servicios', en: 'Other' }
    };
    const item = map[type];
    return item ? (this.langService.lang() === 'es' ? item.es : item.en) : (type || 'Consulta');
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'APPROVED': return 'bg-success-subtle text-success border border-success-subtle';
      case 'PAID': return 'bg-primary-subtle text-primary border border-primary-subtle';
      case 'UNDER_REVIEW': return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'REJECTED': return 'bg-danger-subtle text-danger border border-danger-subtle';
      case 'PARTIALLY_APPROVED': return 'bg-info-subtle text-info-emphasis border border-info-subtle';
      default: return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
    }
  }

  getStatusLabel(status: string): string {
    const map: Record<string, { es: string, en: string }> = {
      EMITTED: { es: 'Emitido', en: 'Emitted' },
      UNDER_REVIEW: { es: 'En Revisión', en: 'Under Review' },
      APPROVED: { es: 'Aprobado', en: 'Approved' },
      PARTIALLY_APPROVED: { es: 'Parcialmente Aprobado', en: 'Partially Approved' },
      REJECTED: { es: 'Rechazado', en: 'Rejected' },
      PAID: { es: 'Pagado', en: 'Paid' },
      CANCELLED: { es: 'Anulado', en: 'Cancelled' }
    };
    const item = map[status];
    return item ? (this.langService.lang() === 'es' ? item.es : item.en) : (status || 'Emitido');
  }

  printCurrentVoucher() {
    window.print();
  }
}
