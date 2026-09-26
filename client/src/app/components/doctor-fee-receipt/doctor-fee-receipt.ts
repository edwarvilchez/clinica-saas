import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { CurrencyService } from '../../services/currency.service';
import { API_URL } from '../../api-config';

@Component({
  selector: 'app-doctor-fee-receipt',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-vh-100 bg-light py-5 px-3">
      <div class="container" style="max-width: 800px;">
        <!-- Navigation / Actions -->
        <div class="d-flex justify-content-between align-items-center mb-4 d-print-none">
          <a routerLink="/doctor-fees" class="btn btn-outline-secondary btn-sm rounded-pill px-3">
            <i class="bi bi-arrow-left me-1"></i> {{ langService.lang() === 'es' ? 'Volver al Sistema' : 'Back to System' }}
          </a>
          <button class="btn btn-primary-premium btn-sm rounded-pill px-4 shadow-sm" (click)="printReceipt()">
            <i class="bi bi-printer me-1"></i> {{ langService.lang() === 'es' ? 'Imprimir / Guardar PDF' : 'Print / Save PDF' }}
          </button>
        </div>

        <!-- Loading / Error States -->
        <div *ngIf="loading()" class="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
          <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
          <h5 class="fw-bold text-dark">{{ langService.lang() === 'es' ? 'Cargando Recibo de Pago...' : 'Loading Payment Receipt...' }}</h5>
        </div>

        <div *ngIf="!loading() && error()" class="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
          <i class="bi bi-shield-x text-danger display-4 mb-3"></i>
          <h4 class="fw-bold text-dark">{{ langService.lang() === 'es' ? 'Recibo No Encontrado' : 'Receipt Not Found' }}</h4>
          <p class="text-muted">{{ error() }}</p>
        </div>

        <!-- Receipt Document Card -->
        <div *ngIf="!loading() && receipt()" class="card border-0 shadow-lg rounded-4 overflow-hidden bg-white print-area">
          <!-- Top Watermark Bar -->
          <div class="bg-primary bg-gradient text-white p-4 text-center position-relative">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div class="text-start">
                <span class="badge bg-white text-primary rounded-pill px-3 py-1 fw-bold text-uppercase x-small mb-1">
                  {{ langService.lang() === 'es' ? 'COMPROBANTE OFICIAL DE PAGO' : 'OFFICIAL PAYMENT VOUCHER' }}
                </span>
                <h4 class="fw-bold mb-0">CLINICA - SAAS</h4>
                <span class="x-small opacity-75">RIF: J-50123456-7 | Sistema Contable y Médico Hospitalario</span>
              </div>
              <div class="text-end">
                <span class="d-block x-small opacity-75">{{ langService.lang() === 'es' ? 'Nro. de Recibo' : 'Receipt No.' }}</span>
                <span class="fs-5 fw-bold font-monospace">{{ receipt()?.receiptNumber }}</span>
                <div class="badge bg-success bg-opacity-25 border border-white text-white rounded-pill px-2 py-1 x-small d-block mt-1">
                  <i class="bi bi-check-circle-fill me-1"></i>{{ langService.lang() === 'es' ? 'CANCELADO Y LIQUIDADO' : 'SETTLED & PAID' }}
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 p-md-5">
            <!-- Payment Timestamp & Verification -->
            <div class="row g-3 mb-4 pb-3 border-bottom">
              <div class="col-sm-6">
                <span class="text-muted x-small text-uppercase fw-bold d-block">{{ langService.lang() === 'es' ? 'Fecha y Hora de Cancelación' : 'Settlement Date & Time' }}</span>
                <strong class="text-dark fs-6">{{ formatDateTime(receipt()?.paidAt) }}</strong>
              </div>
              <div class="col-sm-6 text-sm-end">
                <span class="text-muted x-small text-uppercase fw-bold d-block">{{ langService.lang() === 'es' ? 'Forma de Pago & Referencia' : 'Payment Method & Ref' }}</span>
                <strong class="text-primary">{{ receipt()?.paidPaymentMethod || 'Transferencia Bancaria' }}</strong>
                <span class="text-muted x-small d-block font-monospace">Ref: {{ receipt()?.paymentReference || 'N/A' }}</span>
              </div>
            </div>

            <!-- Doctor & Patient 2-Column Info -->
            <div class="row g-4 mb-4">
              <!-- Beneficiary Doctor -->
              <div class="col-md-6">
                <div class="bg-light bg-opacity-50 p-3 rounded-4 h-100 border">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <i class="bi bi-person-badge-fill text-primary fs-5"></i>
                    <h6 class="fw-bold mb-0 text-dark">{{ langService.lang() === 'es' ? 'Profesional Médico (Beneficiario)' : 'Doctor (Beneficiary)' }}</h6>
                  </div>
                  <div class="small">
                    <strong class="d-block text-dark fs-6">{{ receipt()?.doctor?.name }}</strong>
                    <span class="text-muted d-block">{{ receipt()?.doctor?.specialty }}</span>
                    <span *ngIf="receipt()?.doctor?.university" class="text-muted x-small d-block">
                      <i class="bi bi-bank me-1"></i>{{ receipt()?.doctor?.university }}
                    </span>
                    <div class="mt-2 pt-2 border-top x-small">
                      <span class="d-block"><strong>MPPS:</strong> {{ receipt()?.doctor?.mppsNumber || 'N/A' }}</span>
                      <span class="d-block"><strong>Colegio Médico:</strong> {{ receipt()?.doctor?.collegeNumber || 'N/A' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Clinical Service & Patient -->
              <div class="col-md-6">
                <div class="bg-light bg-opacity-50 p-3 rounded-4 h-100 border">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <i class="bi bi-file-medical-fill text-info fs-5"></i>
                    <h6 class="fw-bold mb-0 text-dark">{{ langService.lang() === 'es' ? 'Servicio y Paciente Atendido' : 'Service & Patient Attended' }}</h6>
                  </div>
                  <div class="small">
                    <strong class="d-block text-dark">{{ receipt()?.service?.concept }}</strong>
                    <span class="badge bg-secondary bg-opacity-10 text-secondary rounded-pill mb-2">{{ receipt()?.service?.serviceType }}</span>
                    <div class="pt-2 border-top x-small">
                      <span class="d-block"><strong>{{ langService.lang() === 'es' ? 'Paciente:' : 'Patient:' }}</strong> {{ receipt()?.patient?.name }}</span>
                      <span *ngIf="receipt()?.insurance" class="d-block text-primary mt-1">
                        <strong>{{ langService.lang() === 'es' ? 'Aseguradora:' : 'Insurance:' }}</strong> {{ receipt()?.insurance?.name }} ({{ receipt()?.insurance?.rif }})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Financial Breakdown Table -->
            <div class="table-responsive mb-4">
              <table class="table table-bordered align-middle">
                <thead class="bg-light text-muted x-small text-uppercase">
                  <tr>
                    <th>{{ langService.lang() === 'es' ? 'Descripción Financiera' : 'Financial Breakdown' }}</th>
                    <th class="text-center">{{ langService.lang() === 'es' ? 'Porcentaje / Régimen' : 'Rate / Scheme' }}</th>
                    <th class="text-end">{{ langService.lang() === 'es' ? 'Monto USD ($)' : 'Amount USD ($)' }}</th>
                    <th class="text-end">{{ langService.lang() === 'es' ? 'Monto VES (Bs)' : 'Amount VES (Bs)' }}</th>
                  </tr>
                </thead>
                <tbody class="small">
                  <tr>
                    <td>{{ langService.lang() === 'es' ? 'Monto Bruto del Servicio Clínico' : 'Gross Clinical Service Amount' }}</td>
                    <td class="text-center font-monospace">100.00%</td>
                    <td class="text-end fw-semibold">$ {{ receipt()?.amounts?.totalAmountUSD }}</td>
                    <td class="text-end text-muted">{{ formatVES(receipt()?.amounts?.totalAmountUSD, receipt()?.bcvRate) }}</td>
                  </tr>
                  <tr>
                    <td>{{ langService.lang() === 'es' ? 'Honorario Médico Pactado' : 'Doctor Agreed Fee' }}</td>
                    <td class="text-center font-monospace text-primary fw-bold">{{ receipt()?.amounts?.doctorPercent }}%</td>
                    <td class="text-end fw-semibold text-primary">$ {{ receipt()?.amounts?.doctorAmountUSD }}</td>
                    <td class="text-end text-muted">{{ formatVES(receipt()?.amounts?.doctorAmountUSD, receipt()?.bcvRate) }}</td>
                  </tr>
                  <tr>
                    <td>{{ langService.lang() === 'es' ? 'Comisión Operativa de la Clínica' : 'Clinic Operational Fee' }}</td>
                    <td class="text-center font-monospace">{{ receipt()?.amounts?.clinicPercent }}%</td>
                    <td class="text-end text-muted">$ {{ receipt()?.amounts?.clinicAmountUSD }}</td>
                    <td class="text-end text-muted">{{ formatVES(receipt()?.amounts?.clinicAmountUSD, receipt()?.bcvRate) }}</td>
                  </tr>
                  <tr class="bg-light">
                    <td class="text-danger fw-semibold">
                      <i class="bi bi-dash-circle me-1"></i>{{ langService.lang() === 'es' ? 'Retención ISLR Personas Naturales (SENIAT)' : 'ISLR Tax Retention (SENIAT)' }}
                    </td>
                    <td class="text-center font-monospace text-danger fw-bold">-{{ receipt()?.amounts?.retentionIslrPercent }}%</td>
                    <td class="text-end text-danger fw-bold">-$ {{ receipt()?.amounts?.retentionIslrUSD }}</td>
                    <td class="text-end text-danger">-{{ formatVES(receipt()?.amounts?.retentionIslrUSD, receipt()?.bcvRate) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="table-success">
                    <td colspan="2" class="fw-bold fs-6">
                      <i class="bi bi-wallet2 me-2"></i>{{ langService.lang() === 'es' ? 'TOTAL NETO CANCELADO AL PROFESIONAL' : 'TOTAL NET SETTLED TO DOCTOR' }}
                    </td>
                    <td class="text-end fw-bold fs-5 text-success">$ {{ receipt()?.amounts?.netPayableUSD }}</td>
                    <td class="text-end fw-bold fs-6 text-success">{{ formatVES(receipt()?.amounts?.netPayableUSD, receipt()?.bcvRate) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Official Seal & Security Token -->
            <div class="row g-3 align-items-center pt-3 border-top x-small text-muted">
              <div class="col-md-8">
                <p class="mb-1">
                  <strong>{{ langService.lang() === 'es' ? 'Normativa Legal:' : 'Legal Compliance:' }}</strong> 
                  {{ langService.lang() === 'es' ? 'Comprobante emitido de acuerdo a la Ley de Impuesto sobre la Renta (ISLR Decreto 1808) y normativa VEN-NIF. Tasa BCV Oficial: ' : 'Voucher issued under ISLR and VEN-NIF regulations. Official BCV Rate: ' }}
                  <strong>{{ receipt()?.bcvRate }} Bs/$</strong>.
                </p>
                <span class="font-monospace d-block">UUID Token: {{ receipt()?.receiptToken }}</span>
              </div>
              <div class="col-md-4 text-md-end">
                <div class="border p-2 rounded-3 d-inline-block bg-light text-center">
                  <i class="bi bi-qr-code fs-3 text-dark d-block"></i>
                  <span class="x-small fw-bold text-uppercase">{{ langService.lang() === 'es' ? 'Comprobante Válido' : 'Verified Voucher' }}</span>
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
export class DoctorFeeReceiptComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  public langService = inject(LanguageService);
  public currencyService = inject(CurrencyService);

  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  receipt = signal<any | null>(null);

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set('Token de recibo no proporcionado.');
      this.loading.set(false);
      return;
    }

    this.http.get<any>(`${API_URL}/public/receipt/doctor-fee/${token}`).subscribe({
      next: (data) => {
        this.receipt.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'No se pudo cargar la información del recibo de pago.');
        this.loading.set(false);
      }
    });
  }

  formatDateTime(dt: string): string {
    if (!dt) return 'N/A';
    const d = new Date(dt);
    return d.toLocaleString('es-VE', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    });
  }

  formatVES(usdAmount: any, bcvRate: any): string {
    const usd = parseFloat(usdAmount || 0);
    const rate = parseFloat(bcvRate || this.currencyService.rate || 1.0);
    const ves = usd * rate;
    return `Bs. ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  printReceipt() {
    window.print();
  }
}
