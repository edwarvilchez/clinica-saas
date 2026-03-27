import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { API_URL, APP_VERSION } from '../../api-config';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

type AccountType = 'PATIENT' | 'PROFESSIONAL' | 'CLINIC' | 'HOSPITAL';

interface OrgOption {
  type: AccountType;
  icon: string;
  labelKey: string;
  descKey: string;
  color: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register implements OnInit, OnDestroy {
  registerForm: FormGroup;
  version = APP_VERSION;
  loading = false;
  private formSub?: Subscription;
  private readonly STORAGE_KEY = 'ClinicaSaaS_register_draft';

  /** Step 1 = type selection, Step 2 = form */
  step = signal<1 | 2>(1);
  accountType = signal<AccountType>('PATIENT');

  orgOptions: OrgOption[] = [
    { type: 'PATIENT', icon: 'bi-person-heart', labelKey: 'register.patient', descKey: 'register.patientDesc', color: 'primary' },
    { type: 'PROFESSIONAL', icon: 'bi-briefcase-fill', labelKey: 'landing.professional', descKey: 'register.professionalDesc', color: 'success' },
    { type: 'CLINIC', icon: 'bi-building', labelKey: 'landing.clinic', descKey: 'register.clinicDesc', color: 'info' },
    { type: 'HOSPITAL', icon: 'bi-hospital-fill', labelKey: 'landing.hospital', descKey: 'register.hospitalDesc', color: 'warning' },
  ];

  isPatient = computed(() => this.accountType() === 'PATIENT');
  isProvider = computed(() => !this.isPatient());
  needsBusinessName = computed(() => this.accountType() === 'CLINIC' || this.accountType() === 'HOSPITAL');

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    public langService: LanguageService
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      // Patient fields
      documentId: [''],
      phone: ['', [Validators.pattern(/^[0-9+\-\s()]+$/)]],
      birthDate: [''],
      gender: [''],
      address: [''],
      bloodType: [''],
      allergies: [''],
      // Provider fields
      businessName: [''],
      licenseNumber: [''],
      // Common
      accountType: ['PATIENT'],
      acceptTerms: [false, Validators.requiredTrue],
    });
  }

  ngOnInit() {
    const savedDraft = localStorage.getItem(this.STORAGE_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        this.registerForm.patchValue(draft);
        if (draft.accountType) {
          this.accountType.set(draft.accountType);
        }
      } catch (_) { }
    }

    this.formSub = this.registerForm.valueChanges.subscribe(values => {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(values));
    });
  }

  ngOnDestroy() {
    this.formSub?.unsubscribe();
  }

  /** Step 1 → Step 2 */
  selectAccountType(type: AccountType) {
    this.accountType.set(type);
    this.registerForm.patchValue({ accountType: type });
    this.updateValidators(type);
    this.step.set(2);
  }

  goBack() {
    this.step.set(1);
  }

  getSelectedOption(): OrgOption | undefined {
    return this.orgOptions.find(opt => opt.type === this.accountType());
  }

  private updateValidators(type: AccountType) {
    const c = (name: string) => this.registerForm.get(name)!;

    if (type === 'PATIENT') {
      c('documentId').setValidators([Validators.required]);
      c('phone').setValidators([Validators.required, Validators.pattern(/^[0-9+\-\s()]+$/)]);
      c('birthDate').setValidators([Validators.required]);
      c('gender').setValidators([Validators.required]);
      c('businessName').clearValidators();
      c('licenseNumber').clearValidators();
    } else {
      c('documentId').clearValidators();
      c('birthDate').clearValidators();
      c('gender').clearValidators();
      c('licenseNumber').setValidators([Validators.required]);
      c('phone').setValidators([Validators.pattern(/^[0-9+\-\s()]+$/)]);
      if (type === 'CLINIC' || type === 'HOSPITAL') {
        c('businessName').setValidators([Validators.required]);
      } else {
        c('businessName').clearValidators();
      }
    }

    ['documentId', 'phone', 'birthDate', 'gender', 'businessName', 'licenseNumber'].forEach(
      name => c(name).updateValueAndValidity()
    );
  }


  onSubmit() {
    if (this.registerForm.valid) {
      this.loading = true;
      const f = this.registerForm.value;

      const data: any = {
        username: f.username,
        email: f.email,
        // No se envía contraseña — el backend siempre genera una temporal (Opción B)
        firstName: f.firstName,
        lastName: f.lastName,
        accountType: f.accountType,
        businessName: f.businessName,
        licenseNumber: f.licenseNumber,
        address: f.address,
        phone: f.phone,
      };

      if (f.accountType === 'PATIENT') {
        data.patientData = {
          documentId: f.documentId,
          phone: f.phone,
          birthDate: f.birthDate,
          gender: f.gender,
          address: f.address,
          bloodType: f.bloodType,
          allergies: f.allergies,
        };
      }

      this.http.post(`${API_URL}/auth/register`, data).subscribe({
        next: (res: any) => {
          this.loading = false;
          localStorage.removeItem(this.STORAGE_KEY);

          // Mostrar contraseña temporal al usuario (Opción B)
          Swal.fire({
            title: '✅ ¡Cuenta Creada!',
            html: `
              <p class="mb-2">Tu cuenta ha sido creada exitosamente.</p>
              <p class="mb-1 text-muted small">Se generó una <strong>contraseña temporal</strong> para tu acceso inicial:</p>
              <div style="
                background: #0f172a;
                color: #38bdf8;
                font-family: monospace;
                font-size: 1.4rem;
                font-weight: 700;
                letter-spacing: 0.15em;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                margin: 0.75rem 0;
                border: 1px solid #10b981;
              ">${res.temporaryPassword || '(ver en API)'}</div>
              <p class="text-warning small mb-0">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                <strong>Guárdala ahora.</strong> Al ingresar, el sistema te pedirá cambiarla.
              </p>
            `,
            icon: 'success',
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Ir al Login',
            allowOutsideClick: false,
          }).then(() => this.router.navigate(['/login']));
        },
        error: (err) => {
          this.loading = false;
          Swal.fire({
            title: this.langService.translate('register.error'),
            text: err.error?.message || 'No se pudo completar el registro.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
          });
        },
      });
    } else {
      Object.keys(this.registerForm.controls).forEach(key => {
        const ctrl = this.registerForm.get(key);
        if (ctrl?.invalid) ctrl.markAsTouched();
      });
    }
  }

  getErrorMessage(fieldName: string): string {
    const control = this.registerForm.get(fieldName);
    const es = this.langService.lang() === 'es';
    if (control?.hasError('required')) return es ? 'Campo requerido' : 'Required';
    if (control?.hasError('email')) return es ? 'Email inválido' : 'Invalid email';
    if (control?.hasError('minlength'))
      return es ? `Mínimo ${control.errors?.['minlength'].requiredLength} caracteres` : `Min ${control.errors?.['minlength'].requiredLength} chars`;
    if (control?.hasError('pattern')) return es ? 'Formato inválido' : 'Invalid format';
    return '';
  }

  viewHistory() {
    Swal.fire({
      title: 'Acceso Restringido',
      text: 'Para ver tu historial médico digital, debes iniciar sesión.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Iniciar Sesión',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#10b981',
    }).then(r => { if (r.isConfirmed) this.router.navigate(['/login']); });
  }
}
