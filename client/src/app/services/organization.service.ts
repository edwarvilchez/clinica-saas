import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api-config';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private apiUrl = `${API_URL}/organization`;
  
  // Settings signal for reactive updates across the app
  settings = signal<any>({
    primaryColor: '#10b981',
    logoUrl: '',
    name: ''
  });

  constructor(private http: HttpClient) {
    this.loadSettings();
  }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  loadSettings() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('OrganizationService: No token found, skipping loadSettings.');
      return;
    }

    this.http.get<any>(`${this.apiUrl}/settings`, { headers: this.getHeaders() }).subscribe({
      next: (org) => {
        if (org && org.settings) {
          this.settings.set({
            ...org.settings,
            name: org.name
          });
          this.applyTheme(org.settings.primaryColor);
        }
      },
      error: (err) => {
        if (err.status !== 401) {
          console.error('Error loading organization settings:', err);
        }
      }
    });
  }

  updateSettings(data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/settings`, data, { headers: this.getHeaders() }).pipe(
      tap(org => {
        this.settings.set({
          ...org.settings,
          name: org.name
        });
        if (org.settings.primaryColor) {
          this.applyTheme(org.settings.primaryColor);
        }
      })
    );
  }

  private applyTheme(color: string) {
    if (!color) return;
    document.documentElement.style.setProperty('--primary', color);
    document.documentElement.style.setProperty('--primary-dark', this.adjustColor(color, -20));
  }

  private adjustColor(col: string, amt: number) {
    let usePound = false;
    if (col[0] === '#') {
      col = col.slice(1);
      usePound = true;
    }

    // Handle 3-digit hex
    if (col.length === 3) {
      col = col[0] + col[0] + col[1] + col[1] + col[2] + col[2];
    }

    const num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255; else if (g < 0) g = 0;

    // Pad with zeros to ensure 6-digit hex
    return (usePound ? '#' : '') + 
      ((r << 16) | (b << 8) | g).toString(16).padStart(6, '0');
  }
}
