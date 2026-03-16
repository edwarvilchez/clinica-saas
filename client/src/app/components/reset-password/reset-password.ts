import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../api-config';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword implements OnInit {
  resetForm: FormGroup;
  status = signal<{ type: string; message: string }>({ type: '', message: '' });
  loading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  token: string = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.resetForm = this.fb.group({
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Get token from URL params
    this.route.params.subscribe(params => {
      this.token = params['token'] || '';
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit() {
    if (this.resetForm.valid) {
      this.loading.set(true);
      this.status.set({ type: '', message: '' });

      const data = {
        token: this.token,
        password: this.resetForm.value.password,
        confirmPassword: this.resetForm.value.confirmPassword
      };

      this.http.post(`${API_URL}/auth/reset-password`, data)
        .subscribe({
          next: (response: any) => {
            this.loading.set(false);
            this.status.set({
              type: 'success',
              message: 'Contraseña actualizada. Redirigiendo...'
            });
            setTimeout(() => this.router.navigate(['/login']), 2000);
          },
          error: (err) => {
            this.loading.set(false);
            const errorMessage = err.error?.message || err.error?.error || 'Error al restablecer contraseña';
            this.status.set({ type: 'error', message: errorMessage });
          }
        });
    }
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }
}
