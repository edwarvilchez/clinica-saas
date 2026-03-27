import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { OrganizationService } from '../../services/organization.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './branding.html',
  styles: [`
    .card-premium { border-radius: 1.5rem !important; }
    .color-preview { border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .report-preview-box { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1) !important; transform: scale(0.95); transition: all 0.5s ease; width: 100%; max-width: 800px; margin: 0 auto; }
    .report-preview-box:hover { transform: scale(1); }
    .h-20 { height: 20px; } .h-10 { height: 10px; }
    .pulse { background: #f1f5f9; animation: pulse 2s infinite ease-in-out; }
    @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
  `]
})
export class Branding implements OnInit {
  orgName = signal('');
  primaryColor = signal('#10b981');
  logoUrl = signal('');
  
  isSaving = signal(false);

  constructor(
    private orgService: OrganizationService,
    private langService: LanguageService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const s = this.orgService.settings();
    this.orgName.set(s.name || '');
    this.primaryColor.set(s.primaryColor || '#10b981');
    this.logoUrl.set(s.logoUrl || '');
  }

  saveSettings() {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    this.isSaving.set(true);

    const payload = {
      name: this.orgName(),
      settings: {
        primaryColor: this.primaryColor(),
        logoUrl: this.logoUrl()
      }
    };

    this.orgService.updateSettings(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        Swal.fire({
          title: 'Configuración Guardada',
          text: 'La imagen corporativa ha sido actualizada exitosamente.',
          icon: 'success',
          confirmButtonColor: this.primaryColor()
        });
        
        // Reload settings globally
        this.orgService.loadSettings();

        // Update local user data if needed for display
        if (userData.Organization) {
           userData.Organization.name = this.orgName();
           localStorage.setItem('user', JSON.stringify(userData));
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
      }
    });
  }

  onLogoUpload(event: any) {
    // In a real app, upload to S3/Cloudinary and get URL
    // For demo, we can use a small base64 or a direct URL input
    // Let's implement a simple direct URL for now and recommend a placeholder
  }
}
