import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { API_URL } from '../../api-config';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './billing.html',
  styles: [`
    .icon-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; }
    .bg-primary-soft { background-color: rgba(14, 165, 233, 0.1) !important; }
    .bg-success-soft { background-color: rgba(34, 197, 94, 0.1) !important; }
    .bg-warning-soft { background-color: rgba(234, 179, 8, 0.1) !important; }
    .bg-danger-soft { background-color: rgba(239, 68, 68, 0.1) !important; }
    .progress { background-color: #f1f5f9; border-radius: 999px; }
    .progress-bar { border-radius: 999px; }
    .card { transition: transform 0.2s ease, box-shadow 0.2s ease; border-radius: 1rem; }
    .card:hover { transform: translateY(-5px); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important; }
    .table th { font-weight: 600; font-size: 0.75rem; letter-spacing: 0.05em; padding: 1rem; }
    .table td { padding: 1rem; }
    .x-small { font-size: 0.7rem; }
  `]
})
export class Billing implements OnInit {
  orgData = signal<any>(null);
  payments = signal<any[]>([]);
  daysLeft = signal<number>(0);
  loading = signal(true);

  constructor(
    public authService: AuthService,
    public langService: LanguageService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.fetchData();
  }

  fetchData() {
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
    
    // Fetch user and organization info
    this.http.get(`${API_URL}/auth/me`, { headers }).subscribe({
      next: (user: any) => {
        if (user.Organization) {
          this.orgData.set(user.Organization);
          this.calculateDaysLeft(user.Organization.trialEndsAt);
        }
      }
    });

    // Fetch payments related to organization
    this.http.get(`${API_URL}/payments`, { headers }).subscribe({
      next: (data: any) => {
        const filtered = data.filter((p: any) => p.paymentType === 'SUBSCRIPTION');
        this.payments.set(filtered);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  calculateDaysLeft(dateStr: string) {
    if (!dateStr) return;
    const end = new Date(dateStr);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    this.daysLeft.set(days > 0 ? days : 0);
  }

  getStatusBadge(status: string) {
    if (status === 'ACTIVE') return 'bg-success';
    if (status === 'TRIAL') return 'bg-info text-dark';
    if (status === 'PAST_DUE') return 'bg-warning text-dark';
    return 'bg-danger';
  }
}
