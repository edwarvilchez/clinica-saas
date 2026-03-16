import { Component, Output, EventEmitter, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { LanguageService } from '../../../services/language.service';
import { CurrencyService } from '../../../services/currency.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  @Output() toggleSidebar = new EventEmitter<void>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isInside = target.closest('.user-dropdown-container'); // Need to add this class to container
    if (!isInside) {
      this.isUserMenuOpen = false;
    }
  }

  isUserMenuOpen = false;

  constructor(
    public authService: AuthService,
    public langService: LanguageService,
    public currencyService: CurrencyService
  ) { }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  setLanguage(lang: 'es' | 'en') {
    this.langService.setLanguage(lang);
  }


  setCurrency(currency: 'USD' | 'VES') {
    this.currencyService.setCurrency(currency);
  }

  logout() {
    Swal.fire({
      title: '¿Cerrar Sesión?',
      text: "Tendrás que ingresar tus credenciales de nuevo.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#64748b',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
      }
    });
  }

  openProfileModal() {
    // Placeholder - user data update
    Swal.fire({
      title: 'Actualizar Datos',
      html: `
        <input id="swal-input1" class="swal2-input" placeholder="Nombre" value="${this.authService.currentUser()?.firstName || ''}">
        <input id="swal-input2" class="swal2-input" placeholder="Apellido" value="${this.authService.currentUser()?.lastName || ''}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        return [
          (document.getElementById('swal-input1') as HTMLInputElement).value,
          (document.getElementById('swal-input2') as HTMLInputElement).value
        ]
      }
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire('¡Actualizado!', 'Tus datos han sido actualizados (Simulación).', 'success');
        // TODO: Call API to update user
      }
    });
  }

  openChangePasswordModal() {
    let toggleState = false;
    const updateFields = () => {
      const container = document.getElementById('password-fields-container');
      if (container) {
        container.style.display = toggleState ? 'block' : 'none';
      }
    };

    Swal.fire({
      title: 'Cambiar Contraseña',
      html: `
        <div style="text-align: left; font-size: 0.9rem; color: #64748b; margin-bottom: 1rem;">
          <strong>¿Deseas cambiar tu contraseña?</strong>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
          <label style="position: relative; display: inline-block; width: 50px; height: 26px; margin: 0;">
            <input type="checkbox" id="password-toggle" style="opacity: 0; width: 0; height: 0;">
            <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.4s; border-radius: 26px;"></span>
            <span style="position: absolute; content: ''; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: 0.4s; border-radius: 50%;"></span>
          </label>
          <span id="toggle-label" style="margin-left: 10px; color: #64748b; font-size: 0.85rem;">No</span>
        </div>
        <div id="password-fields-container" style="display: none;">
          <div style="text-align: left; font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; border: 1px solid #e2e8f0; padding: 0.75rem; border-radius: 0.5rem; background-color: #f8fafc;">
            <strong>Requisitos de la nueva contraseña:</strong>
            <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0;">
              <li>Mínimo 8 caracteres</li>
              <li>Al menos una mayúscula y una minúscula</li>
              <li>Al menos un número</li>
            </ul>
          </div>
          <input type="password" id="current-pass" class="swal2-input" placeholder="Contraseña Actual">
          <input type="password" id="new-pass" class="swal2-input" placeholder="Nueva Contraseña">
          <input type="password" id="confirm-pass" class="swal2-input" placeholder="Confirmar Nueva Contraseña">
        </div>
      `,
      confirmButtonText: 'Guardar',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        const toggle = document.getElementById('password-toggle') as HTMLInputElement;
        const label = document.getElementById('toggle-label');
        const slider = document.querySelector('#password-toggle + span') as HTMLElement;
        
        if (toggle && label && slider) {
          toggle.addEventListener('change', function() {
            toggleState = this.checked;
            const container = document.getElementById('password-fields-container');
            if (container) {
              container.style.display = toggleState ? 'block' : 'none';
            }
            label.textContent = toggleState ? 'Sí' : 'No';
            slider.style.backgroundColor = toggleState ? '#0ea5e9' : '#ccc';
            slider.style.transform = toggleState ? 'translateX(24px)' : 'translateX(0)';
          });
        }
      },
      preConfirm: () => {
        if (!toggleState) {
          return { skipPasswordChange: true };
        }
        const current = (document.getElementById('current-pass') as HTMLInputElement).value;
        const newPass = (document.getElementById('new-pass') as HTMLInputElement).value;
        const confirm = (document.getElementById('confirm-pass') as HTMLInputElement).value;

        if (!current || !newPass || !confirm) {
          Swal.showValidationMessage('Todos los campos son obligatorios');
          return false;
        }
        if (newPass !== confirm) {
          Swal.showValidationMessage('Las contraseñas nuevas no coinciden');
          return false;
        }
        return { current, newPass, skipPasswordChange: false };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.value?.skipPasswordChange) {
          return;
        }
        const { current, newPass } = result.value;
        this.authService.changePassword({
          currentPassword: current,
          newPassword: newPass
        }).subscribe({
          next: () => {
            Swal.fire('¡Éxito!', 'Tu contraseña ha sido actualizada.', 'success');
          },
          error: (err) => {
            console.error('Password change error:', err);
            let errorMessage = 'No se pudo cambiar la contraseña';

            if (err.error?.errors && Array.isArray(err.error.errors) && err.error.errors.length > 0) {
              errorMessage = err.error.errors[0].message;
            } else if (err.error?.message) {
              errorMessage = err.error.message;
            }

            Swal.fire('Error', errorMessage, 'error');
          }
        });
      }
    });
  }

  canManageRate() {
    const role = this.authService.currentUser()?.Role?.name || this.authService.currentUser()?.role;
    return ['SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE'].includes(role);
  }

  openExchangeRateModal() {
    if (!this.canManageRate()) return;
    
    Swal.fire({
      title: 'Actualizar Tasa BCV',
      text: `Tasa actual: ${this.currencyService.rate()} Bs.`,
      input: 'number',
      inputAttributes: {
        step: '0.01',
        min: '1'
      },
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0ea5e9',
      preConfirm: (value) => {
        if (!value || isNaN(parseFloat(value))) {
          Swal.showValidationMessage('Ingrese un valor válido');
        }
        return parseFloat(value);
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.currencyService.setRate(result.value);
        Swal.fire('¡Éxito!', `La tasa se ha actualizado a ${result.value} Bs.`, 'success');
      }
    });
  }
}
