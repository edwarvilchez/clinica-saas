import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { API_URL } from '../../api-config';
import Swal from 'sweetalert2';

interface DoctorFeeItem {
  id: string;
  doctorId: string;
  patientId?: string;
  clinicalServiceId?: string;
  insuranceCompanyId?: string;
  serviceConcept: string;
  serviceType: string;
  feeType: string;
  totalAmountUSD: string;
  totalAmountVES?: string;
  bcvRate?: string;
  doctorPercent: number;
  clinicPercent: number;
  doctorAmountUSD: string;
  clinicAmountUSD: string;
  retentionIslrPercent: number;
  retentionIslrUSD: string;
  netPayableUSD: string;
  status: string;
  settlementDate?: string;
  paidAt?: string;
  paidAmountUSD?: string;
  paidAmountVES?: string;
  paidPaymentMethod?: string;
  paymentReference?: string;
  receiptNumber?: string;
  receiptToken?: string;
  notes?: string;
  selected?: boolean;
  Doctor?: any;
  Patient?: any;
  ClinicalService?: any;
  InsuranceCompany?: any;
}

@Component({
  selector: 'app-doctor-fees',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './doctor-fees.html',
  styleUrls: ['./doctor-fees.css']
})
export class DoctorFeesComponent implements OnInit {
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  fees = signal<DoctorFeeItem[]>([]);
  doctors = signal<any[]>([]);
  doctorConfigs = signal<any[]>([]);
  patients = signal<any[]>([]);
  clinicalServices = signal<any[]>([]);
  insuranceCompanies = signal<any[]>([]);
  loading = signal<boolean>(true);

  // Tabs: 'pending' (Por Pagar), 'paid' (Pagados), 'baremos' (Configuración de Honorarios)
  activeTab = signal<'pending' | 'paid' | 'baremos'>('pending');
  viewMode = signal<'list' | 'kanban'>('list');
  searchTerm = signal<string>('');

  // Selected for Payment
  selectedFees = signal<DoctorFeeItem[]>([]);

  // Modals State
  showCreateModal = false;
  showPayModal = false;
  showConfigModal = false;
  showReceiptModal = false;

  currentReceipt: any = null;

  // New Fee Form
  currentFee: any = {
    doctorId: '',
    patientId: '',
    clinicalServiceId: '',
    insuranceCompanyId: '',
    serviceConcept: '',
    serviceType: 'CONSULTATION',
    feeType: 'PERCENTAGE',
    totalAmountUSD: 50.00,
    doctorPercent: 70,
    clinicPercent: 30,
    fixedFeeUSD: 35.00,
    retentionIslrPercent: 3.0,
    notes: ''
  };

  // Payment Form (CXP Checkout)
  payForm: any = {
    paymentMethod: 'Transferencia Bancaria (Banesco)',
    paymentReference: '',
    notes: ''
  };

  // Baremo Config Form
  currentDoctorConfig: any = {
    doctorId: '',
    doctorName: '',
    specialty: '',
    feeType: 'PERCENTAGE',
    doctorPercent: 70,
    clinicPercent: 30,
    fixedFeeUSD: 30.00,
    insuranceDoctorPercent: 65,
    insuranceFixedFeeUSD: 25.00,
    acceptsInsurance: true,
    chargesProfessionalFees: true
  };

  // Computeds
  pendingFees = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.fees().filter(f => {
      const isPending = f.status === 'PENDING';
      const docName = `${f.Doctor?.User?.firstName || ''} ${f.Doctor?.User?.lastName || ''}`.toLowerCase();
      const patName = `${f.Patient?.User?.firstName || ''} ${f.Patient?.User?.lastName || ''}`.toLowerCase();
      const concept = (f.serviceConcept || '').toLowerCase();
      const matches = docName.includes(term) || patName.includes(term) || concept.includes(term);
      return isPending && matches;
    });
  });

  paidFees = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.fees().filter(f => {
      const isPaid = f.status === 'PAID';
      const docName = `${f.Doctor?.User?.firstName || ''} ${f.Doctor?.User?.lastName || ''}`.toLowerCase();
      const patName = `${f.Patient?.User?.firstName || ''} ${f.Patient?.User?.lastName || ''}`.toLowerCase();
      const receipt = (f.receiptNumber || '').toLowerCase();
      const matches = docName.includes(term) || patName.includes(term) || receipt.includes(term);
      return isPaid && matches;
    });
  });

  totalPendingUSD = computed(() => {
    return this.fees()
      .filter(f => f.status === 'PENDING')
      .reduce((sum, f) => sum + parseFloat(f.netPayableUSD || '0'), 0);
  });

  totalPaidUSD = computed(() => {
    return this.fees()
      .filter(f => f.status === 'PAID')
      .reduce((sum, f) => sum + parseFloat(f.paidAmountUSD || f.netPayableUSD || '0'), 0);
  });

  selectedTotalNetUSD = computed(() => {
    return this.selectedFees().reduce((sum, f) => sum + parseFloat(f.netPayableUSD || '0'), 0);
  });

  getFeesByStatus(status: string): DoctorFeeItem[] {
    return this.fees().filter(f => (f.status || 'PENDING') === status);
  }

  getFeesStageTotalUSD(status: string): number {
    return this.getFeesByStatus(status).reduce((acc, f) => acc + (parseFloat(f.netPayableUSD) || 0), 0);
  }

  selectedTotalGrossUSD = computed(() => {
    return this.selectedFees().reduce((sum, f) => sum + parseFloat(f.totalAmountUSD || '0'), 0);
  });

  selectedTotalRetentionUSD = computed(() => {
    return this.selectedFees().reduce((sum, f) => sum + parseFloat(f.retentionIslrUSD || '0'), 0);
  });

  ngOnInit() {
    this.loadData();
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  loadData() {
    this.loading.set(true);
    const headers = this.getHeaders();

    this.http.get<DoctorFeeItem[]>(`${API_URL}/doctor-fees`, { headers }).subscribe({
      next: (data) => {
        this.fees.set(data || []);
        this.selectedFees.set([]);
        this.loadSupportingCatalogs();
      },
      error: () => this.loading.set(false)
    });
  }

  loadSupportingCatalogs() {
    const headers = this.getHeaders();
    this.http.get<any[]>(`${API_URL}/doctor-fees/doctor-configs`, { headers }).subscribe({
      next: (configs) => this.doctorConfigs.set(configs || [])
    });

    this.http.get<any[]>(`${API_URL}/doctors`, { headers }).subscribe({
      next: (docs) => this.doctors.set(docs || [])
    });

    this.http.get<any[]>(`${API_URL}/patients`, { headers }).subscribe({
      next: (pats) => this.patients.set(pats || [])
    });

    this.http.get<any[]>(`${API_URL}/sales/services`, { headers }).subscribe({
      next: (srvs) => this.clinicalServices.set(srvs || [])
    });

    this.http.get<any[]>(`${API_URL}/insurance/companies`, { headers }).subscribe({
      next: (ins) => {
        this.insuranceCompanies.set(ins || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // Checkbox Selection
  toggleSelectAll(event: any) {
    const checked = event.target.checked;
    const currentList = this.pendingFees();
    currentList.forEach(f => f.selected = checked);
    this.selectedFees.set(checked ? [...currentList] : []);
  }

  toggleSelectFee(fee: DoctorFeeItem) {
    fee.selected = !fee.selected;
    const current = this.fees().filter(f => f.status === 'PENDING' && f.selected);
    this.selectedFees.set(current);
  }

  isAllSelected(): boolean {
    const list = this.pendingFees();
    if (list.length === 0) return false;
    return list.every(f => f.selected);
  }

  // Open Pay Selected Modal
  openPayModal(singleFee?: DoctorFeeItem) {
    if (singleFee) {
      this.fees().forEach(f => f.selected = false);
      singleFee.selected = true;
      this.selectedFees.set([singleFee]);
    }

    if (this.selectedFees().length === 0) {
      Swal.fire({
        title: this.langService.lang() === 'es' ? 'Atención' : 'Attention',
        text: this.langService.lang() === 'es' ? 'Selecciona al menos un honorario por pagar.' : 'Select at least one pending fee to pay.',
        icon: 'warning',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    this.payForm = {
      paymentMethod: 'Transferencia Bancaria (Banesco)',
      paymentReference: `REF-${Date.now() % 1000000}`,
      notes: ''
    };
    this.showPayModal = true;
  }

  confirmPayment() {
    const feeIds = this.selectedFees().map(f => f.id);
    const payload = {
      feeIds,
      paymentMethod: this.payForm.paymentMethod,
      paymentReference: this.payForm.paymentReference,
      bcvRate: this.currencyService.rate,
      notes: this.payForm.notes
    };

    this.http.post<any>(`${API_URL}/doctor-fees/pay`, payload, { headers: this.getHeaders() }).subscribe({
      next: (res) => {
        this.showPayModal = false;
        this.loadData();
        Swal.fire({
          title: this.langService.lang() === 'es' ? '¡Pago Procesado!' : 'Payment Processed!',
          html: `
            <p>${res.message}</p>
            <div class="alert alert-success p-2 small">
              <strong>Monto Total Cancelado:</strong> $${res.totalPaidUSD} (${this.currencyService.formatAmount(res.totalPaidUSD, 'VES')})<br>
              <strong>Recibos Generados:</strong> ${res.receiptNumbers?.join(', ')}
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#10b981'
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'Error al procesar el pago', 'error');
      }
    });
  }

  // Baremo Configuration Methods
  openConfigModal(config: any) {
    this.currentDoctorConfig = { ...config };
    this.showConfigModal = true;
  }

  saveDoctorConfig() {
    this.http.put(`${API_URL}/doctor-fees/doctor-configs/${this.currentDoctorConfig.doctorId}`, this.currentDoctorConfig, {
      headers: this.getHeaders()
    }).subscribe({
      next: () => {
        this.showConfigModal = false;
        this.loadData();
        Swal.fire({
          title: this.langService.lang() === 'es' ? '¡Baremo Actualizado!' : 'Fee Rules Updated!',
          text: this.langService.lang() === 'es' ? 'Los honorarios y porcentajes del médico han sido guardados.' : 'Doctor fee percentages and fixed rules saved successfully.',
          icon: 'success',
          confirmButtonColor: '#10b981'
        });
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar baremo', 'error')
    });
  }

  // Manual Fee Creation
  openCreateModal() {
    this.currentFee = {
      doctorId: this.doctors().length > 0 ? this.doctors()[0].id : '',
      patientId: this.patients().length > 0 ? this.patients()[0].id : '',
      clinicalServiceId: '',
      insuranceCompanyId: '',
      serviceConcept: '',
      serviceType: 'CONSULTATION',
      feeType: 'PERCENTAGE',
      totalAmountUSD: 50.00,
      doctorPercent: 70,
      clinicPercent: 30,
      fixedFeeUSD: 35.00,
      retentionIslrPercent: 3.0,
      notes: ''
    };
    this.onDoctorSelected();
    this.showCreateModal = true;
  }

  onDoctorSelected() {
    const docConfig = this.doctorConfigs().find(c => c.doctorId === this.currentFee.doctorId);
    if (docConfig) {
      this.currentFee.feeType = docConfig.feeType || 'PERCENTAGE';
      this.currentFee.doctorPercent = docConfig.doctorPercent || 70;
      this.currentFee.clinicPercent = docConfig.clinicPercent || 30;
      this.currentFee.fixedFeeUSD = docConfig.fixedFeeUSD || 30;
    }
  }

  onServiceSelected() {
    const srv = this.clinicalServices().find(s => s.id === this.currentFee.clinicalServiceId);
    if (srv) {
      this.currentFee.serviceConcept = srv.name;
      this.currentFee.totalAmountUSD = parseFloat(srv.basePriceUSD || '50.00');
    }
  }

  saveFee() {
    if (!this.currentFee.doctorId || !this.currentFee.serviceConcept || !this.currentFee.totalAmountUSD) {
      Swal.fire('Atención', 'Médico, concepto y monto son obligatorios', 'warning');
      return;
    }

    const payload = {
      ...this.currentFee,
      bcvRate: this.currencyService.rate
    };

    this.http.post(`${API_URL}/doctor-fees`, payload, {
      headers: this.getHeaders()
    }).subscribe({
      next: () => {
        Swal.fire({
          title: 'Registrado',
          text: 'Honorario médico enviado a Cuentas por Pagar (CXP)',
          icon: 'success',
          confirmButtonColor: '#10b981'
        });
        this.showCreateModal = false;
        this.loadData();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al registrar', 'error')
    });
  }

  // View Digital Receipt Modal & Link Sharing
  viewReceipt(fee: DoctorFeeItem) {
    if (!fee.receiptToken) {
      Swal.fire('Atención', 'Este registro no posee un comprobante digital generado.', 'info');
      return;
    }

    this.http.get<any>(`${API_URL}/public/receipt/doctor-fee/${fee.receiptToken}`).subscribe({
      next: (data) => {
        this.currentReceipt = data;
        this.showReceiptModal = true;
      },
      error: () => Swal.fire('Error', 'No se pudo consultar el recibo', 'error')
    });
  }

  copyReceiptLink(feeOrToken: any) {
    const token = typeof feeOrToken === 'string' ? feeOrToken : (feeOrToken?.receiptToken);
    if (!token) return;
    const url = `${window.location.origin}/doctor-fee-receipt/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      Swal.fire({
        title: this.langService.lang() === 'es' ? '¡Enlace Copiado!' : 'Link Copied!',
        html: `
          <p class="small text-muted mb-2">${this.langService.lang() === 'es' ? 'Comparte este enlace para que el médico o auditor consulte el recibo de pago oficial:' : 'Share this link for official voucher verification:'}</p>
          <input class="form-control form-control-sm text-center font-monospace" value="${url}" readonly>
        `,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    });
  }

  formatDateTime(dt?: string): string {
    if (!dt) return 'N/A';
    const d = new Date(dt);
    return d.toLocaleString('es-VE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }
}
