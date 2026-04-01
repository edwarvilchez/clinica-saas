import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { CurrencyService } from '../../services/currency.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { API_URL, BASE_URL } from '../../api-config';
import Swal from 'sweetalert2';

interface PricingPlan {
  name: string;      // Display Name (e.g., Consultorio)
  type: string;      // Backend Logic Type (PROFESSIONAL, CLINIC, HOSPITAL)
  tagline: string;
  price: number;
  icon: string;      // Bootstrap Icon Class
  color: string;     // color key for css classes
  popular?: boolean;
  features: string[];
  limit: string;
}

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './subscription.html',
  styleUrl: './subscription.css'
})
export class Subscription implements OnInit {
  billingCycle = signal('Mensual');
  currentPlan = signal<string | null>(null);
  currentYear = new Date().getFullYear();
  
  cycles = [
    { id: 'Mensual', id_en: 'Monthly', discount: null },
    { id: 'Trimestral', id_en: 'Quarterly', discount: null },
    { id: 'Semestral', id_en: 'Semester', discount: null },
    { id: 'Anual', id_en: 'Yearly', discount: '-20%' }
  ];

  getCycleLabel(cycle: any): string {
    if (this.langService.lang() === 'en') return cycle.id_en;
    return cycle.id;
  }

  plans: PricingPlan[] = [
    {
      name: "Consultorio",
      type: "PROFESSIONAL",
      tagline: "Médicos Independientes",
      price: 49,
      icon: "bi-person-badge",
      color: "blue",
      features: [
        "1 Médico",
        "Hasta 1,500 Pacientes",
        "Agenda Médica Inteligente",
        "Historia Clínica Digital",
        "Soporte por Email"
      ],
      limit: "Límite: 1,500 Pacientes"
    },
    {
      name: "Clínica",
      type: "CLINIC",
      tagline: "Pequeñas Clínicas / Centros",
      price: 119,
      icon: "bi-hospital",
      color: "primary",
      popular: true,
      features: [
        "Hasta 10 Médicos",
        "Múltiples Recepcionistas",
        "Facturación y Caja",
        "Reportes Financieros",
        "Soporte Prioritario"
      ],
      limit: "Límite: 10 Médicos"
    },
    {
      name: "Hospital",
      type: "HOSPITAL",
      tagline: "Hospitales y Grandes Centros",
      price: 249,
      icon: "bi-building-fill",
      color: "indigo",
      features: [
        "Médicos Ilimitados",
        "Gestión de Camas/Habitaciones",
        "Módulo de Enfermería",
        "Laboratorio Integrado",
        "Auditoría Avanzada"
      ],
      limit: "Sin Límites"
    },
    {
      name: "Enterprise",
      type: "ENTERPRISE",
      tagline: "Redes de Salud",
      price: 499,
      icon: "bi-award-fill",
      color: "neutral",
      features: [
        "Infraestructura Dedicada",
        "API de Integración",
        "App Móvil Personalizada",
        "SLA Garantizado 99.9%",
        "Gerente de Cuenta"
      ],
      limit: "A Medida"
    }
  ];

  team = [
    { role: 'CEO', name: 'César González', tel: '+58 412-XXXXXXX' },
    { role: 'CTO & Software Architect', name: 'Ing. Edwar Vilchez', email: 'edwarvilchez1977@proton.me' }
  ];

  constructor(
    public authService: AuthService,
    public currencyService: CurrencyService,
    public langService: LanguageService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    const user = this.authService.currentUser();
    if (user && user.accountType) {
      this.currentPlan.set(user.accountType);
    }
  }

  setCycle(cycleId: string) {
    this.billingCycle.set(cycleId);
  }

  getCurrentCycleLabel(): string {
    const cycle = this.cycles.find(c => c.id === this.billingCycle());
    return cycle ? this.getCycleLabel(cycle) : '';
  }

  getPrice(basePrice: number): number {
    const cycle = this.billingCycle();
    if (cycle === 'Trimestral') return basePrice * 3;
    if (cycle === 'Semestral') return basePrice * 6;
    if (cycle === 'Anual') return Math.round((basePrice * 12 * 0.8));
    return basePrice;
  }

  getPlanName(plan: any): string {
    if (this.langService.lang() === 'en') {
      if (plan.type === 'PROFESSIONAL') return 'Ind. Practice';
      if (plan.type === 'CLINIC') return 'Clinic';
      if (plan.type === 'HOSPITAL') return 'Hospital';
    }
    return plan.name;
  }

  getPlanTagline(plan: any): string {
     if (this.langService.lang() === 'en') {
        if (plan.type === 'PROFESSIONAL') return 'Individual Doctors';
        if (plan.type === 'CLINIC') return 'Small Clinics / Centers';
        if (plan.type === 'HOSPITAL') return 'Hospitals & Large Centers';
        if (plan.type === 'ENTERPRISE') return 'Health Networks';
     }
     return plan.tagline;
  }

  getPlanLimit(plan: any): string {
     if (this.langService.lang() === 'en') {
        if (plan.type === 'PROFESSIONAL') return 'Limit: 1,500 Patients';
        if (plan.type === 'CLINIC') return 'Limit: 10 Doctors';
        if (plan.type === 'HOSPITAL') return 'No Limits';
        if (plan.type === 'ENTERPRISE') return 'Custom';
     }
     return plan.limit;
  }

  getPlanFeatures(plan: any): string[] {
    if (this.langService.lang() === 'en') {
        if (plan.type === 'PROFESSIONAL') return ["1 Doctor", "Up to 1,500 Patients", "Smart Medical Agenda", "Digital Medical Record", "Email Support"];
        if (plan.type === 'CLINIC') return ["Up to 10 Doctors", "Multiple Receptionists", "Billing & Cashier", "Financial Reports", "Priority Support"];
        if (plan.type === 'HOSPITAL') return ["Unlimited Doctors", "Bed/Room Management", "Nursing Module", "Integrated Laboratory", "Advanced Audit"];
        if (plan.type === 'ENTERPRISE') return ["Dedicated Infrastructure", "Integration API", "Custom Mobile App", "99.9% Guaranteed SLA", "Account Manager"];
    }
    return plan.features;
  }

  getHeaders() {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  payForPlan(plan: PricingPlan) {
    const user = this.authService.currentUser();
    const cycle = this.billingCycle();
    const amount = this.getPrice(plan.price);
    const concept = `Suscripción ${plan.name} (${cycle})`;

    const isEs = this.langService.lang() === 'es';

    Swal.fire({
      title: isEs ? 'Realizar Pago de Suscripción' : 'Make Subscription Payment',
      html: `
        <div class="text-start">
          <div class="alert alert-info border-0 shadow-sm mb-3">
            <h6 class="fw-bold mb-1"><i class="bi bi-cart-check"></i> ${isEs ? 'Resumen del Pedido' : 'Order Summary'}</h6>
            <div class="d-flex justify-content-between">
              <span>${isEs ? 'Plan' : 'Plan'}:</span> <strong>${this.getPlanName(plan)}</strong>
            </div>
            <div class="d-flex justify-content-between">
              <span>${isEs ? 'Ciclo' : 'Cycle'}:</span> <strong>${this.getCycleLabel(this.cycles.find(c => c.id === cycle))}</strong>
            </div>
            <hr class="my-2">
            <div class="d-flex justify-content-between fs-5">
              <span>${isEs ? 'Total a Pagar' : 'Total to Pay'}:</span> <strong class="text-primary">${this.currencyService.formatAmount(amount)}</strong>
            </div>
            <div class="small text-muted mt-1">≈ ${this.currencyService.formatAmount(amount, this.currencyService.currency() === 'USD' ? 'VES' : 'USD')}</div>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-bold mb-1">${isEs ? 'Método de Pago' : 'Payment Method'}</label>
            <select id="method" class="form-select form-select-sm">
                <option value="Transferencia">${isEs ? 'Transferencia Bancaria (Bs.)' : 'Bank Transfer (Bs.)'}</option>
                <option value="Pago Móvil">${isEs ? 'Pago Móvil (Bs.)' : 'Mobile Payment (Bs.)'}</option>
                <option value="Zelle">Zelle (USD)</option>
                <option value="Binance">Binance Pay (USDT)</option>
            </select>
          </div>

          <div id="bankDetails" class="alert alert-secondary p-2 mb-3 small">
            <p class="mb-0"><strong>${isEs ? 'Datos de Pago:' : 'Payment Details:'}</strong></p>
            <p class="mb-0">Banesco: 0134-XXXX-XX-XXXXXXXXXX</p>
            <p class="mb-0">Pago Móvil: 0412-XXXXXXX / J-12345678</p>
            <p class="mb-0">Zelle: cgk888digital@gmail.com</p>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-bold mb-1">${isEs ? 'Referencia / comprobante' : 'Reference / Proof'}</label>
            <input id="ref" class="form-control form-control-sm" placeholder="${isEs ? 'Número de confirmación' : 'Confirmation Number'}">
          </div>
          
          <div class="mb-3">
             <label class="form-label small fw-bold mb-1">${isEs ? 'Adjuntar Recibo (Opcional)' : 'Attach Receipt (Optional)'}</label>
             <input id="receiptFile" type="file" class="form-control form-control-sm" accept="image/*,application/pdf">
          </div>
        </div>
      `,
      confirmButtonText: isEs ? 'Confirmar Pago' : 'Confirm Payment',
      showCancelButton: true,
      cancelButtonText: isEs ? 'Cancelar' : 'Cancel',
      confirmButtonColor: '#10b981',
      preConfirm: () => {
        const method = (document.getElementById('method') as HTMLSelectElement).value;
        const ref = (document.getElementById('ref') as HTMLInputElement).value;
        const fileInput = document.getElementById('receiptFile') as HTMLInputElement;
        const file = fileInput?.files ? fileInput.files[0] : null;

        if (!ref) {
          Swal.showValidationMessage(isEs ? 'Por favor ingrese el número de referencia' : 'Please enter reference number');
          return false;
        }

        const formData = new FormData();
        formData.append('concept', concept);
        formData.append('amount', amount.toString());
        formData.append('currency', 'USD');
        formData.append('reference', ref);
        formData.append('instrument', method);
        formData.append('status', 'Pending');
        formData.append('type', 'SUBSCRIPTION'); 
        formData.append('planType', plan.type); 
        formData.append('billingCycle', cycle);
        
        if (file) formData.append('receipt', file);
        return formData;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const url = user ? `${API_URL}/payments/subscription` : `${API_URL}/payments/subscription/guest`;
        const headers = user ? { headers: this.getHeaders() } : {};
        
        this.http.post(url, result.value, headers)
          .subscribe({
            next: (res: any) => {
              const successTitle = user ? (isEs ? '¡Pago Enviado!' : 'Payment Sent!') : this.langService.translate('payments.onboardingSuccess');
              const successText = user 
                ? (isEs ? 'Tu pago ha sido registrado y está siendo verificado. Te notificaremos cuando tu plan esté activo.' : 'Your payment has been recorded and is being verified. We will notify you when your plan is active.')
                : this.langService.translate('payments.onboardingRegister');

              Swal.fire({
                title: successTitle,
                text: successText,
                icon: 'success',
                confirmButtonText: user ? 'OK' : this.langService.translate('payments.goToRegister'),
                confirmButtonColor: '#10b981'
              }).then(() => {
                if (!user) {
                  this.router.navigate(['/register'], { 
                    queryParams: { 
                      plan: plan.type,
                      cycle: cycle,
                      paymentId: res.id || res.id
                    } 
                  });
                }
              });
            },
            error: (err) => {
              console.error(err);
              Swal.fire(
                isEs ? 'Error' : 'Error', 
                isEs ? 'No se pudo procesar el pago. Por favor intente más tarde.' : 'Could not process payment. Please try again later.', 
                'error'
              );
            }
          });
      }
    });
  }
}
