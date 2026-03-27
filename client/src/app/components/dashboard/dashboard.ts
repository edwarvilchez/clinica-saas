import { Component, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StatsService } from '../../services/stats.service';
import { ExportService } from '../../services/export.service';
import { CurrencyService } from '../../services/currency.service';
import Swal from 'sweetalert2';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, Chart, registerables } from 'chart.js';

// Registrar componentes de Chart.js
Chart.register(...registerables);

import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {


  stats = signal<any>({
    appointmentsToday: 0,
    totalPatients: 0,
    monthlyIncome: 0,
    pendingAppointments: 0,
    upcomingAppointments: [],
    activityData: [],
    inPersonCount: 0,
    videoCount: 0,
    specialtyStats: [],
    incomeDetails: {
      day: { USD: 0, Bs: 0 },
      week: { USD: 0, Bs: 0 },
      month: { USD: 0, Bs: 0 }
    }
  });

  // Configuración del Gráfico
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        boxPadding: 4
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: { 
        beginAtZero: true, 
        grid: { color: '#f1f5f9' },
        ticks: { stepSize: 1 }
      }
    },
    elements: {
      bar: {
        borderRadius: 8,
        borderSkipped: false
      }
    }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Citas', backgroundColor: '#3b82f6', hoverBackgroundColor: '#2563eb' }
    ]
  };

  // Configuración del Gráfico de Rosca (Especialidades)
  public pieChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true, 
        position: 'bottom',
        labels: {
          boxWidth: 8,
          font: { size: 9 },
          padding: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: '#e2e8f0',
        borderWidth: 1
      }
    },
    cutout: '70%'
  };
  public pieChartType: ChartType = 'doughnut';
  public pieChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [] }]
  };

  constructor(
    private statsService: StatsService,
    private exportService: ExportService,
    public authService: AuthService,
    public langService: LanguageService,
    public currencyService: CurrencyService,
    private router: Router
  ) {
    // Reaccionar cuando cambian los stats para actualizar los gráficos
    effect(() => {
      const stats = this.stats();
      
      // Update Bar Chart
      if (stats.activityData && stats.activityData.length > 0) {
        this.updateChartData(stats.activityData);
      } else {
        this.updateChartData([]);
      }

      // Update Pie Chart
      if (stats.specialtyStats && stats.specialtyStats.length > 0) {
        this.updatePieChartData(stats.specialtyStats);
      }
    });
  }

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.statsService.getDashboardStats().subscribe({
      next: (data) => {
        console.log('Dashboard stats loaded:', data);
        this.stats.set(data);
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        
        let errorMessage = 'No se pudieron cargar las estadísticas';
        
        if (err.status === 401) {
          // Clear session immediately to prevent loop
          this.authService.logout(); 
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          // logout() already redirects, but checking logic keeps it safe
        } else if (err.status === 0) {
          errorMessage = 'No se puede conectar con el servidor. Verifica tu conexión.';
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        }
        
        Swal.fire({
          title: 'Error',
          text: errorMessage,
          icon: 'error',
          confirmButtonColor: '#ef4444'
        });
      }
    });
  }

  updateChartData(activityData: any[]) {
    // Agrupar citas por fecha (últimos 7 días)
    const daysMap = new Map<string, number>();
    const today = new Date();
    
    // Inicializar últimos 7 días con 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayName = d.toLocaleDateString(this.langService.locale(), { weekday: 'short' });
      const dayKey = dayName.charAt(0).toUpperCase() + dayName.slice(1); // Capitalizar
      daysMap.set(dayKey, 0);
    }

    // Llenar con datos reales
    if (activityData && activityData.length > 0) {
      activityData.forEach(item => {
        const date = new Date(item.date);
        const dayName = date.toLocaleDateString(this.langService.locale(), { weekday: 'short' });
        const dayKey = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        
        // Solo actualizar si la fecha cae en el rango de los últimos 7 días
        if (daysMap.has(dayKey)) {
          daysMap.set(dayKey, (daysMap.get(dayKey) || 0) + 1);
        }
      });
    }

    // Actualizar datos del gráfico
    this.barChartData = {
      labels: Array.from(daysMap.keys()),
      datasets: [
        { 
          data: Array.from(daysMap.values()), 
          label: this.langService.translate('dashboard.stats.appointments'), 
          backgroundColor: '#10b981',
          hoverBackgroundColor: '#059669',
          borderColor: 'transparent',
          barThickness: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 20,
          borderRadius: 4
        }
      ]
    };
  }

  updatePieChartData(specialtyStats: any[]) {
    // Only show specialties with active appointments (pending or completed)
    const activeStats = specialtyStats.filter(s => (s.pending + s.completed) > 0);
    
    this.pieChartData = {
      labels: activeStats.map(s => s.name),
      datasets: [{
        data: activeStats.map(s => s.pending + s.completed),
        backgroundColor: [
          '#10b981', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
          '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
        ],
        hoverOffset: 4,
        borderWidth: 0
      }]
    };
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatBs(amount: number): string {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES'
    }).format(amount);
  }

  formatTime(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  downloadDailyReport() {
    const s = this.stats();
    const headers = ['Estadística', 'Valor'];
    const rows = [
      ['Citas Hoy', s.appointmentsToday],
      ['Pacientes Totales', s.totalPatients],
      ['Presenciales (Mes)', s.inPersonCount],
      ['Videoconsultas (Mes)', s.videoCount],
      ['Ingresos USD (Mes)', s.incomeDetails?.month?.USD || 0],
      ['Ingresos Bs (Mes)', s.incomeDetails?.month?.Bs || 0],
    ];

    if (s.specialtyStats && s.specialtyStats.length > 0) {
      rows.push(['', '']);
      rows.push(['Rendimiento por Especialidad', '']);
      s.specialtyStats.forEach((ext: any) => {
        rows.push([ext.name, `Pend: ${ext.pending} / Atend: ${ext.completed}`]);
      });
    }

    Swal.fire({
      title: 'Exportar Reporte',
      text: 'Seleccione el formato de descarga',
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-file-pdf"></i> PDF',
      denyButtonText: '<i class="bi bi-file-excel"></i> Excel',
      cancelButtonText: '<i class="bi bi-file-text"></i> CSV',
      confirmButtonColor: '#ef4444',
      denyButtonColor: '#22c55e',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      const filename = `Reporte_Diario_${new Date().toISOString().split('T')[0]}`;
      const title = 'Reporte de Actividad - Clinica SaaS';
      const user = this.authService.currentUser();
      
      const branding = {
        name: user?.businessName || (user?.accountType === 'PROFESSIONAL' ? `${user.firstName} ${user.lastName}` : 'Clinica SaaS Platform'),
        professional: user ? `${user.firstName} ${user.lastName}` : undefined,
        tagline: user?.businessName ? this.langService.translate('landing.description').substring(0, 30) + '...' : 'Gestión Clínica Profesional'
      };
      
      if (result.isConfirmed) {
        this.exportService.exportToPdf(filename, title, headers, rows, branding);
      } else if (result.isDenied) {
        this.exportService.exportToExcel(filename, headers, rows, branding);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.exportService.exportToCsv(filename, headers, rows);
      }
    });
  }

  goToNewAppointment() {
    this.router.navigate(['/appointments']);
    setTimeout(() => {
      Swal.fire({
        title: 'Nueva Cita',
        text: 'Redirigiendo al módulo de citas...',
        icon: 'info',
        showConfirmButton: false,
        timer: 1000
      });
    }, 100);
  }
  getUserTitle(): string {
    const user = this.authService.currentUser();
    if (!user) return '';

    const role = user.role?.toUpperCase();
    const gender = user.gender;
    const lang = this.langService.locale();

    if (role === 'DOCTOR') {
      if (lang.startsWith('en')) return 'Dr.';
      // Spanish
      if (gender === 'Male') return 'Dr.';
      if (gender === 'Female') return 'Dra.';
      return 'Dr./Dra.';
    }

    // Other roles
    if (lang.startsWith('en')) {
        if (gender === 'Male') return 'Mr.';
        if (gender === 'Female') return 'Ms.';
        return '';
    }

    // Spanish
    if (gender === 'Male') return 'Sr.';
    if (gender === 'Female') return 'Sra.';

    return '';
  }

  isTrialActive(): boolean {
    const user = this.authService.currentUser();
    const org = user?.Organization;
    if (org && org.subscriptionStatus === 'TRIAL') {
      return this.getTrialDaysLeft() >= 0;
    }
    return false;
  }

  getTrialDaysLeft(): number {
    const user = this.authService.currentUser();
    const org = user?.Organization;
    if (!org?.trialEndsAt) return 0;
    
    const end = new Date(org.trialEndsAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  }

  isTrialExpired(): boolean {
    const user = this.authService.currentUser();
    const org = user?.Organization;
    if (org && org.subscriptionStatus === 'TRIAL') {
        return this.getTrialDaysLeft() < 0;
    }
    return false;
  }

  upgradePlan() {
    this.router.navigate(['/payments']);
  }
}
