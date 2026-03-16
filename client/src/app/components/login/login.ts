import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

import { LanguageService } from '../../services/language.service';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit, OnDestroy {
  loginForm: FormGroup;
  loading = signal(false);
  error = signal('');
  currentYear = new Date().getFullYear();
  private formSub?: Subscription;
  private readonly STORAGE_KEY = 'medicus_login_email';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    public langService: LanguageService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    const savedEmail = localStorage.getItem(this.STORAGE_KEY);
    if (savedEmail) {
      this.loginForm.patchValue({ email: savedEmail });
    }

    this.formSub = this.loginForm.get('email')?.valueChanges.subscribe(value => {
      if (value) {
        localStorage.setItem(this.STORAGE_KEY, value);
      }
    });
  }

  ngOnDestroy() {
    if (this.formSub) {
      this.formSub.unsubscribe();
    }
  }

  showPassword = signal(false);

  togglePasswordVisibility() {
    this.showPassword.update(value => !value);
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.loading.set(true);
      this.error.set('');
      this.authService.login(this.loginForm.value).subscribe({
        next: (res) => {
          this.loading.set(false);

          if (res?.user?.mustChangePassword) {
            // El usuario tiene contraseña temporal — mostrar advertencia y redirigir
            Swal.fire({
              title: '⚠️ Contraseña Temporal Detectada',
              html: `
                <p>Has ingresado con una <strong>contraseña temporal</strong>.</p>
                <p>Por seguridad, debes cambiarla antes de acceder al sistema.</p>
              `,
              icon: 'warning',
              confirmButtonText: 'Cambiar ahora',
              confirmButtonColor: '#f59e0b',
              allowOutsideClick: false,
              timer: 3500,
              timerProgressBar: true,
              showConfirmButton: true
            }).then(() => {
              this.router.navigate(['/change-password-first']);
            });
          } else {
            // Acceso normal
            Swal.fire({
              title: `¡Bienvenido, ${res.user.firstName}!`,
              text: 'Sesión iniciada correctamente.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            });
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Error al iniciar sesión. Verifica tus datos.');
          this.loading.set(false);
          Swal.fire({
            title: 'Error de Acceso',
            text: this.error(),
            icon: 'error',
            confirmButtonColor: '#ef4444'
          });
        }
      });
    }
  }
  showSecurityLaws() {
    Swal.fire({
      title: 'Protección y Blindaje Legal',
      html: `
        <div class="text-start">
          <p>Medicus cumple con los más altos estándares internacionales:</p>
          <ul class="list-group list-group-flush mb-0 small">
            <li class="list-group-item bg-transparent px-0 border-0">
              <i class="bi bi-shield-check text-primary me-2"></i><strong>ISO/IEC 27001:</strong> Gestión de Seguridad de la Información.
            </li>
            <li class="list-group-item bg-transparent px-0 border-0">
              <i class="bi bi-award text-success me-2"></i><strong>ISO 9001:</strong> Gestión de Calidad en procesos.
            </li>
            <li class="list-group-item bg-transparent px-0 border-0">
              <i class="bi bi-globe text-info me-2"></i><strong>GDPR:</strong> Reglamento General de Protección de Datos (EU).
            </li>
            <li class="list-group-item bg-transparent px-0 border-0">
              <i class="bi bi-file-earmark-medical text-warning me-2"></i><strong>HIPAA:</strong> Estándares de privacidad para salud.
            </li>
          </ul>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#0ea5e9'
    });
  }

  checkReminders() {
    Swal.fire({
      title: 'Servicio de Recordatorios',
      text: 'El sistema envía recordatorios automáticos vía WhatsApp para todas las citas confirmadas. Por seguridad, debes iniciar sesión para verificar si tienes una cita activa con recordatorio programado.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ir al Formulario',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#64748b'
    });
  }
}
