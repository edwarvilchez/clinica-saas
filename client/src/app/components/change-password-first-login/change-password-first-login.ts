import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

/**
 * Componente: ChangePasswordFirstLogin
 *
 * Propósito: Pantalla obligatoria que se presenta cuando un usuario ingresa
 * por primera vez con una contraseña temporal. El usuario NO puede navegar
 * a ninguna otra sección hasta completar el cambio de contraseña.
 *
 * Patrón de contraseña requerido:
 *   - Mínimo 8 caracteres
 *   - Al menos 1 letra mayúscula
 *   - Al menos 1 letra minúscula
 *   - Al menos 1 número
 */
@Component({
    selector: 'app-change-password-first-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './change-password-first-login.html',
    styleUrl: './change-password-first-login.css'
})
export class ChangePasswordFirstLogin implements OnInit {
    form: FormGroup;
    loading = signal(false);
    showCurrentPassword = signal(false);
    showNewPassword = signal(false);
    showConfirmPassword = signal(false);

    // Patrón de contraseña: mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número
    private readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router
    ) {
        this.form = this.fb.group({
            currentPassword: ['', [Validators.required]],
            newPassword: ['', [
                Validators.required,
                Validators.minLength(8),
                this.passwordPatternValidator.bind(this)
            ]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordsMatchValidator });
    }

    ngOnInit(): void {
        // Mostrar mensaje informativo al cargar la pantalla
        Swal.fire({
            title: '⚠️ Cambio de Contraseña Requerido',
            html: `
        <div style="text-align:left">
          <p>Has ingresado con una <strong>contraseña temporal</strong>.</p>
          <p>Por seguridad, debes crear una contraseña personal antes de continuar.</p>
          <hr/>
          <p><strong>Tu nueva contraseña debe tener:</strong></p>
          <ul style="margin:0; padding-left:1.2rem">
            <li>Mínimo <strong>8 caracteres</strong></li>
            <li>Al menos una <strong>letra mayúscula</strong></li>
            <li>Al menos una <strong>letra minúscula</strong></li>
            <li>Al menos un <strong>número</strong></li>
          </ul>
        </div>
      `,
            icon: 'warning',
            confirmButtonText: 'Entendido, voy a cambiarlo',
            confirmButtonColor: '#f59e0b',
            allowOutsideClick: false,
            allowEscapeKey: false
        });
    }

    toggleCurrentPassword() { this.showCurrentPassword.update(v => !v); }
    toggleNewPassword() { this.showNewPassword.update(v => !v); }
    toggleConfirmPassword() { this.showConfirmPassword.update(v => !v); }

    private passwordPatternValidator(control: AbstractControl): ValidationErrors | null {
        if (!control.value) return null;
        return this.PASSWORD_PATTERN.test(control.value) ? null : { invalidPattern: true };
    }

    private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
        const newPass = group.get('newPassword')?.value;
        const confirm = group.get('confirmPassword')?.value;
        return newPass && confirm && newPass !== confirm ? { passwordsMismatch: true } : null;
    }

    hasUppercase(): boolean {
        const v = this.form.get('newPassword')?.value || '';
        return /[A-Z]/.test(v);
    }

    hasLowercase(): boolean {
        const v = this.form.get('newPassword')?.value || '';
        return /[a-z]/.test(v);
    }

    hasNumber(): boolean {
        const v = this.form.get('newPassword')?.value || '';
        return /\d/.test(v);
    }

    getPasswordError(): string {
        const ctrl = this.form.get('newPassword');
        if (!ctrl?.dirty) return '';
        if (ctrl.hasError('required')) return 'La nueva contraseña es requerida.';
        if (ctrl.hasError('minlength')) return 'Debe tener al menos 8 caracteres.';
        if (ctrl.hasError('invalidPattern')) return 'Debe contener mayúscula, minúscula y número.';
        return '';
    }

    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);

        const { currentPassword, newPassword } = this.form.value;

        this.authService.changePassword({ currentPassword, newPassword }).subscribe({
            next: () => {
                this.authService.clearMustChangePassword();
                this.loading.set(false);

                Swal.fire({
                    title: '✅ ¡Contraseña Actualizada!',
                    html: `
            <p>Tu contraseña ha sido cambiada exitosamente.</p>
            <p>Ahora tienes <strong>acceso completo</strong> al sistema.</p>
          `,
                    icon: 'success',
                    confirmButtonText: 'Ir al Panel Principal',
                    confirmButtonColor: '#10b981',
                    allowOutsideClick: false
                }).then(() => {
                    this.router.navigate(['/dashboard']);
                });
            },
            error: (err) => {
                this.loading.set(false);
                Swal.fire({
                    title: 'Error al cambiar contraseña',
                    text: err.error?.message || 'Ocurrió un error. Verifica tu contraseña actual e intenta de nuevo.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
            }
        });
    }
}
