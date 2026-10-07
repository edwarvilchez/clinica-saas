import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Navbar } from './components/shared/navbar/navbar';
import { Sidebar } from './components/shared/sidebar/sidebar';
import { CallNotification } from './components/shared/call-notification/call-notification';
import { filter } from 'rxjs/operators';
import { LanguageService } from './services/language.service';
import { CurrencyService } from './services/currency.service';
import { VideoConsultationService } from './services/video-consultation.service';
import { APP_VERSION } from './api-config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, Navbar, Sidebar, CallNotification],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Clínica SaaS');
  isSidebarOpen = false;
  isSidebarCollapsed = false;
  currentYear = new Date().getFullYear();
  version = APP_VERSION;
  
  constructor(
    private router: Router,
    public langService: LanguageService,
    private currencyService: CurrencyService,
    private videoService: VideoConsultationService
  ) {}

  ngOnInit() {
    // Localización de tasa BCV y moneda
    this.currencyService.initializeRate().catch(err => console.error('Rate init error:', err));
    
    // Registro de socket para notificaciones globales
    this.videoService.registerGlobalSocket();
    
    // Close sidebar on route change (mobile UX)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeSidebar();
    });
  }
  
  isAuthPage(): boolean {
      const path = window.location.pathname;
      return path === '/' 
          || path.includes('landing')
          || path.includes('login') 
          || path.includes('register')
          || path.includes('agendar-cita')
          || path.includes('forgot-password')
          || path.includes('reset-password')
          || path.includes('subscription');
  }

  toggleSidebar() {
    if (window.innerWidth < 992) {
      this.isSidebarOpen = !this.isSidebarOpen;
    } else {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }
}
