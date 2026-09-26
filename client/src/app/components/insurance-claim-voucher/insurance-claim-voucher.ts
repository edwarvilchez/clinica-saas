import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { API_URL } from '../../api-config';

@Component({
  selector: 'app-insurance-claim-voucher',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-vh-100 bg-light py-4 px-3">
      <div class="container" style="max-width: 900px;">
        <!-- Navigation / Actions -->
        <div class="d-flex justify-content-between align-items-center mb-4 d-print-none">
          <a routerLink="/insurance" class="btn btn-outline-secondary btn-sm rounded-pill px-3 shadow-sm">
            <i class="bi bi-arrow-left me-1"></i> {{ langService.lang() === 'es' ? 'Volver al Módulo de Seguros' : 'Back to Insurance Module' }}
          </a>
          <div class="d-flex gap-2">
            <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm fw-semibold" (click)="printVoucher()">
              <i class="bi bi-printer me-1"></i> {{ langService.lang() === 'es' ? 'Imprimir Comprobante / PDF' : 'Print Voucher / PDF' }}
            </button>
          </div>
        </div>

        <!-- Loading / Error States -->
        <div *ngIf="loading()" class="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
          <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
          <h5 class="fw-bold text-dark">{{ langService.lang() === 'es' ? 'Cargando Comprobante de Siniestro...' : 'Loading Claim Voucher...' }}</h5>
        </div>

        <div *ngIf="!loading() && error()" class="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
          <i class="bi bi-shield-x text-danger display-4 mb-3"></i>
          <h4 class="fw-bold text-dark">{{ langService.lang() === 'es' ? 'Comprobante No Encontrado' : 'Voucher Not Found' }}</h4>
          <p class="text-muted">{{ error() }}</p>
        </div>

        <!-- Voucher Document Card -->
        <div *ngIf="!loading() && claim()" class="card border-0 shadow-lg rounded-4 overflow-hidden bg-white print-area">
          <!-- Top Header Bar -->
          <div class="bg-dark bg-gradient text-white p-4 position-relative">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                  <span class="badge bg-primary text-white rounded-pill px-3 py-1 fw-bold text-uppercase x-small">
                    {{ langService.lang() === 'es' ? 'COMPROBANTE OFICIAL DE RECLAMO A ASEGURADORA' : 'OFFICIAL INSURANCE CLAIM VOUCHER' }}
                  </span>
                  <span class="badge" [ngClass]="getStatusBadgeClass(claim()?.status)">
                    {{ getStatusLabel(claim()?.status) }}
                  </span>
                </div>
                <h4 class="fw-bold mb-0 text-white">{{ claim()?.organization?.name || 'CLÍNICA - SAAS INTERNACIONAL' }}</h4>
                <span class="x-small opacity-75">RIF: {{ claim()?.organization?.rif || 'J-40987654-1' }} | {{ claim()?.organization?.address || 'Centro Médico Hospitalario' }}</span>
              </div>
              <div class="text-end">
                <span class="d-block x-small opacity-75">{{ langService.lang() === 'es' ? 'Nro. de Siniestro / Reclamo' : 'Claim Reference No.' }}</span>
                <span class="fs-4 fw-bold font-monospace text-warning">{{ claim()?.claimNumber }}</span>
                <span class="d-block x-small opacity-75 mt-1">{{ langService.lang() === 'es' ? 'Fecha de Emisión:' : 'Issued Date:' }} {{ formatDate(claim()?.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div class="p-4 p-md-5">
            <!-- 2-Column Info Grid: Insurance Company & Patient -->
            <div class="row g-4 mb-4">
              <!-- Insurance Provider Box -->
              <div class="col-md-6">
                <div class="p-3 rounded-4 h-100 border bg-light bg-opacity-50">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <i class="bi bi-shield-shaded text-primary fs-5"></i>
                    <h6 class="fw-bold mb-0 text-dark">{{ langService.lang() === 'es' ? 'Empresa Aseguradora' : 'Insurance Provider' }}</h6>
                  </div>
                  <div class="small">
                    <strong class="d-block text-dark fs-6">{{ claim()?.insuranceCompany?.name }}</strong>
                    <span class="badge bg-light text-dark border rounded-pill x-small mb-2">{{ claim()?.insuranceCompany?.rif }}</span>
                    <div class="x-small text-muted">
                      <div class="mb-1"><i class="bi bi-person me-1"></i><strong>{{ langService.lang() === 'es' ? 'Atención / Contacto:' : 'Contact:' }}</strong> {{ claim()?.insuranceCompany?.contactPerson || 'Departamento de Siniestros y Cartas Aval' }}</div>
                      <div class="mb-1"><i class="bi bi-envelope me-1"></i>{{ claim()?.insuranceCompany?.email || 'N/A' }}</div>
                      <div><i class="bi bi-telephone me-1"></i>{{ claim()?.insuranceCompany?.phone || 'N/A' }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Patient & Policy Box -->
              <div class="col-md-6">
                <div class="p-3 rounded-4 h-100 border bg-light bg-opacity-50">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <i class="bi bi-person-vcard text-success fs-5"></i>
                    <h6 class="fw-bold mb-0 text-dark">{{ langService.lang() === 'es' ? 'Datos del Paciente Asegurado' : 'Insured Patient Data' }}</h6>
                  </div>
                  <div class="small">
                    <strong class="d-block text-dark fs-6">{{ claim()?.patient?.User?.firstName }} {{ claim()?.patient?.User?.lastName }}</strong>
                    <div class="x-small text-muted mb-2">
                      <span class="me-3"><strong>C.I. / DNI:</strong> {{ claim()?.patient?.documentId || 'N/A' }}</span>
                      <span *ngIf="claim()?.patient?.phone"><strong>Tlf:</strong> {{ claim()?.patient?.phone }}</span>
                    </div>
                    <div class="p-2 bg-white rounded-3 border x-small">
                      <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">{{ langService.lang() === 'es' ? 'Nro. de Póliza:' : 'Policy No.:' }}</span>
                        <strong class="text-dark font-monospace">{{ claim()?.policyNumber || 'N/A' }}</strong>
                      </div>
                      <div class="d-flex justify-content-between">
                        <span class="text-muted">{{ langService.lang() === 'es' ? 'Carta Aval / Clave Autorización:' : 'Approval Code / Aval:' }}</span>
                        <strong class="text-primary font-monospace">{{ claim()?.authorizationCode || 'N/A' }}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Medical Details & Dates -->
            <div class="card border rounded-4 p-3 bg-light bg-opacity-25 mb-4">
              <div class="row g-3">
                <div class="col-md-4">
                  <span class="text-muted x-small text-uppercase fw-bold d-block">{{ langService.lang() === 'es' ? 'Tipo de Servicio' : 'Service Type' }}</span>
                  <span class="badge bg-secondary rounded-pill px-3 py-1 fw-semibold mt-1">{{ getServiceTypeLabel(claim()?.serviceType) }}</span>
                </div>
                <div class="col-md-4">
                  <span class="text-muted x-small text-uppercase fw-bold d-block">{{ langService.lang() === 'es' ? 'Rango de Fecha de Atención' : 'Service Date Range' }}</span>
                  <strong class="text-dark d-block mt-1">
                    <i class="bi bi-calendar3 me-1 text-primary"></i>{{ formatDate(claim()?.serviceStartDate) }} &rarr; {{ formatDate(claim()?.serviceEndDate) }}
                  </strong>
                </div>
                <div class="col-md-4">
                  <span class="text-muted x-small text-uppercase fw-bold d-block">{{ langService.lang() === 'es' ? 'Médico Tratante / Especialidad' : 'Attending Doctor / Specialty' }}</span>
                  <strong class="text-dark d-block mt-1">{{ claim()?.doctor ? ('Dr(a). ' + claim()?.doctor?.User?.firstName + ' ' + claim()?.doctor?.User?.lastName) : 'Equipo Médico Hospitalario' }}</strong>
                  <span class="x-small text-muted" *ngIf="claim()?.doctor">
                    {{ claim()?.doctor?.Specialty?.name || 'Medicina General' }} | MPPS: {{ claim()?.doctor?.mppsNumber || 'N/A' }} | CM: {{ claim()?.doctor?.collegeNumber || 'N/A' }}
                  </span>
                </div>
                <div class="col-12 pt-2 border-top" *ngIf="claim()?.diagnosis">
                  <span class="text-muted x-small text-uppercase fw-bold d-block">{{ langService.lang() === 'es' ? 'Diagnóstico Clínico / Código CIE-11' : 'Clinical Diagnosis / ICD-11 Code' }}</span>
                  <p class="text-dark mb-0 small fst-italic">{{ claim()?.diagnosis }}</p>
                </div>
              </div>
            </div>

            <!-- Itemized Expenses Table -->
            <div class="mb-4">
              <h6 class="fw-bold text-dark mb-3">
                <i class="bi bi-receipt-cutoff me-2 text-primary"></i>{{ langService.lang() === 'es' ? 'Desglose Detallado de Gastos Médicos Reclamados' : 'Itemized Medical Expenses Claimed' }}
              </h6>
              <div class="table-responsive">
                <table class="table table-bordered align-middle mb-0">
                  <thead class="bg-light text-muted x-small text-uppercase">
                    <tr>
                      <th class="ps-3" style="width: 45%;">{{ langService.lang() === 'es' ? 'Concepto / Servicio / Insumo' : 'Concept / Service / Supply' }}</th>
                      <th class="text-center" style="width: 15%;">{{ langService.lang() === 'es' ? 'Categoría / Cód' : 'Category / Code' }}</th>
                      <th class="text-center" style="width: 10%;">{{ langService.lang() === 'es' ? 'Cant.' : 'Qty' }}</th>
                      <th class="text-end" style="width: 15%;">{{ langService.lang() === 'es' ? 'Precio Unit ($)' : 'Unit Price ($)' }}</th>
                      <th class="text-end pe-3" style="width: 15%;">{{ langService.lang() === 'es' ? 'Subtotal ($)' : 'Subtotal ($)' }}</th>
                    </tr>
                  </thead>
                  <tbody class="small">
                    <tr *ngFor="let item of claim()?.items">
                      <td class="ps-3 fw-semibold text-dark">{{ item.description }}</td>
                      <td class="text-center"><span class="badge bg-light text-muted border rounded-pill x-small">{{ item.code || item.category || 'SERV' }}</span></td>
                      <td class="text-center font-monospace">{{ item.quantity || 1 }}</td>
                      <td class="text-end font-monospace">$ {{ formatNumber(item.unitPriceUSD) }}</td>
                      <td class="text-end pe-3 fw-bold text-dark font-monospace">$ {{ formatNumber(item.totalUSD || (item.quantity * item.unitPriceUSD)) }}</td>
                    </tr>
                    <tr *ngIf="!claim()?.items || claim()?.items.length === 0">
                      <td class="ps-3 fw-semibold text-dark">{{ getServiceTypeLabel(claim()?.serviceType) }}</td>
                      <td class="text-center"><span class="badge bg-light text-muted border rounded-pill x-small">SERV-01</span></td>
                      <td class="text-center font-monospace">1</td>
                      <td class="text-end font-monospace">$ {{ formatNumber(claim()?.grossAmountUSD) }}</td>
                      <td class="text-end pe-3 fw-bold text-dark font-monospace">$ {{ formatNumber(claim()?.grossAmountUSD) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Financial Summary Total Box (Dual Currency USD & VES at BCV rate) -->
            <div class="row g-3 justify-content-end mb-4">
              <div class="col-md-7 col-lg-6">
                <div class="card border-0 bg-light p-3 rounded-4 shadow-sm">
                  <div class="d-flex justify-content-between py-1 border-bottom small">
                    <span class="text-muted">{{ langService.lang() === 'es' ? 'Total Gastos Médicos (Bruto):' : 'Total Medical Expenses (Gross):' }}</span>
                    <strong class="text-dark font-monospace">$ {{ formatNumber(claim()?.grossAmountUSD) }}</strong>
                  </div>
                  <div class="d-flex justify-content-between py-1 border-bottom small text-danger" *ngIf="claim()?.deductibleUSD > 0">
                    <span><i class="bi bi-dash-circle me-1"></i>{{ langService.lang() === 'es' ? 'Menos Deducible (A cargo del paciente):' : 'Less Deductible (Paid by patient):' }}</span>
                    <strong class="font-monospace">-$ {{ formatNumber(claim()?.deductibleUSD) }}</strong>
                  </div>
                  <div class="d-flex justify-content-between py-2 border-bottom">
                    <span class="fw-bold text-dark fs-6">{{ langService.lang() === 'es' ? 'TOTAL NETO RECLAMADO (USD):' : 'TOTAL NET CLAIMED (USD):' }}</span>
                    <span class="fw-bold text-primary fs-5 font-monospace">$ {{ formatNumber(claim()?.claimedAmountUSD) }}</span>
                  </div>
                  <div class="d-flex justify-content-between py-2 align-items-center bg-white rounded-3 px-3 mt-2 border">
                    <div>
                      <span class="x-small text-muted d-block text-uppercase fw-bold">{{ langService.lang() === 'es' ? 'Equivalente en Bolívares (Tasa Oficial BCV)' : 'Equivalent in VES (Official BCV Rate)' }}</span>
                      <span class="x-small text-muted font-monospace">Tasa: {{ claim()?.bcvRate }} Bs/$</span>
                    </div>
                    <span class="fw-bold text-success fs-5 font-monospace">Bs. {{ formatNumber(claim()?.claimedAmountVES) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Observations / Notes -->
            <div class="mb-4" *ngIf="claim()?.notes">
              <div class="p-3 bg-light rounded-4 border">
                <h6 class="fw-bold text-dark x-small text-uppercase mb-1">{{ langService.lang() === 'es' ? 'Observaciones / Notas Adicionales' : 'Remarks / Notes' }}</h6>
                <p class="small text-muted mb-0">{{ claim()?.notes }}</p>
              </div>
            </div>

            <!-- Signatures & Stamp Blocks -->
            <div class="row g-4 pt-4 mt-2 border-top text-center">
              <div class="col-4">
                <div class="border-top border-dark pt-2 mx-2">
                  <span class="fw-bold small d-block text-dark">{{ claim()?.doctor ? ('Dr(a). ' + claim()?.doctor?.User?.firstName + ' ' + claim()?.doctor?.User?.lastName) : 'Médico Tratante' }}</span>
                  <span class="x-small text-muted d-block">{{ langService.lang() === 'es' ? 'Firma y Sello Médico' : 'Doctor Signature & Stamp' }}</span>
                  <span class="x-small text-muted d-block" *ngIf="claim()?.doctor">MPPS: {{ claim()?.doctor?.mppsNumber || 'N/A' }}</span>
                </div>
              </div>
              <div class="col-4">
                <div class="border-top border-dark pt-2 mx-2">
                  <span class="fw-bold small d-block text-dark">{{ langService.lang() === 'es' ? 'Auditoría / Administración' : 'Audit / Administration' }}</span>
                  <span class="x-small text-muted d-block">{{ langService.lang() === 'es' ? 'Firma Autorizada Clínica' : 'Authorized Clinic Stamp' }}</span>
                  <span class="x-small text-muted d-block">{{ claim()?.organization?.rif || 'J-40987654-1' }}</span>
                </div>
              </div>
              <div class="col-4">
                <div class="border-top border-dark pt-2 mx-2">
                  <span class="fw-bold small d-block text-dark">{{ claim()?.patient?.User?.firstName }} {{ claim()?.patient?.User?.lastName }}</span>
                  <span class="x-small text-muted d-block">{{ langService.lang() === 'es' ? 'Firma del Paciente / Asegurado' : 'Insured Patient Signature' }}</span>
                  <span class="x-small text-muted d-block">C.I.: {{ claim()?.patient?.documentId || 'N/A' }}</span>
                </div>
              </div>
            </div>

            <!-- Verification Footer & Token -->
            <div class="row g-3 align-items-center pt-4 mt-3 border-top x-small text-muted">
              <div class="col-md-9">
                <p class="mb-1">
                  <strong>{{ langService.lang() === 'es' ? 'Validez Legal:' : 'Legal Validity:' }}</strong> 
                  {{ langService.lang() === 'es' ? 'Este comprobante oficial constituye solicitud formal de reembolso / cobertura de siniestro médico hospitalario según la Ley de la Actividad Aseguradora y normativa SENIAT / MPPS.' : 'This official claim voucher constitutes a formal reimbursement/coverage request under national insurance laws.' }}
                </p>
                <span class="font-monospace d-block">UUID Token de Verificación: {{ claim()?.claimToken }}</span>
              </div>
              <div class="col-md-3 text-md-end">
                <div class="border p-2 rounded-3 d-inline-block bg-light text-center">
                  <i class="bi bi-qr-code fs-3 text-dark d-block"></i>
                  <span class="x-small fw-bold text-uppercase">{{ langService.lang() === 'es' ? 'Siniestro Verificado' : 'Verified Claim' }}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @media print {
      body { background: white !important; }
      .d-print-none { display: none !important; }
      .print-area { box-shadow: none !important; border: 1px solid #ddd !important; }
    }
  `]
})
export class InsuranceClaimVoucherComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  claim = signal<any | null>(null);

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set('Token de comprobante de reclamo no especificado.');
      this.loading.set(false);
      return;
    }

    this.http.get<any>(`${API_URL}/public/receipt/insurance-claim/${token}`).subscribe({
      next: (data) => {
        this.claim.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'No se pudo cargar el comprobante de reclamo / siniestro.');
        this.loading.set(false);
      }
    });
  }

  formatDate(d: string): string {
    if (!d) return 'N/A';
    const date = new Date(d);
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatNumber(val: any): string {
    const num = parseFloat(val || 0);
    return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getServiceTypeLabel(type: string): string {
    const map: Record<string, { es: string, en: string }> = {
      CONSULTATION: { es: 'Consulta Médica Especializada', en: 'Specialist Consultation' },
      SURGERY: { es: 'Intervención Quirúrgica', en: 'Surgery' },
      HOSPITALIZATION: { es: 'Hospitalización y Cuidados', en: 'Hospitalization & Care' },
      PROCEDURE: { es: 'Procedimiento / Tratamiento', en: 'Clinical Procedure' },
      EMERGENCY: { es: 'Atención de Emergencia', en: 'Emergency Care' },
      LAB_IMAGING: { es: 'Laboratorio e Imagenología', en: 'Lab & Imaging' },
      OTHER: { es: 'Otros Servicios Clínicos', en: 'Other Clinical Services' }
    };
    const item = map[type];
    return item ? (this.langService.lang() === 'es' ? item.es : item.en) : (type || 'Consulta');
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'APPROVED': return 'bg-success text-white';
      case 'PAID': return 'bg-primary text-white';
      case 'UNDER_REVIEW': return 'bg-warning text-dark';
      case 'REJECTED': return 'bg-danger text-white';
      case 'PARTIALLY_APPROVED': return 'bg-info text-white';
      default: return 'bg-secondary text-white';
    }
  }

  getStatusLabel(status: string): string {
    const map: Record<string, { es: string, en: string }> = {
      EMITTED: { es: 'EMITIDO / PENDIENTE DE ENVÍO', en: 'EMITTED / PENDING' },
      UNDER_REVIEW: { es: 'EN REVISIÓN ASEGURADORA', en: 'UNDER INSURER REVIEW' },
      APPROVED: { es: 'APROBADO', en: 'APPROVED' },
      PARTIALLY_APPROVED: { es: 'PARCIALMENTE APROBADO', en: 'PARTIALLY APPROVED' },
      REJECTED: { es: 'RECHAZADO', en: 'REJECTED' },
      PAID: { es: 'PAGADO / LIQUIDADO', en: 'PAID / SETTLED' },
      CANCELLED: { es: 'ANULADO', en: 'CANCELLED' }
    };
    const item = map[status];
    return item ? (this.langService.lang() === 'es' ? item.es : item.en) : (status || 'EMITIDO');
  }

  printVoucher() {
    window.print();
  }
}
