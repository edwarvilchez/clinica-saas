import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { API_URL } from '../api-config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${API_URL}/auth`;
  currentUser = signal<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      this.currentUser.set(JSON.parse(savedUser));
    }
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => this.setSession(res))
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData).pipe(
      tap(res => this.setSession(res))
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private setSession(authResult: any) {
    localStorage.setItem('token', authResult.token);
    localStorage.setItem('user', JSON.stringify(authResult.user));
    this.currentUser.set(authResult.user);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken() {
    return localStorage.getItem('token');
  }

  hasRole(allowedRoles: string[]): boolean {
    const user = this.currentUser();
    if (!user || !user.role) return false;

    const userRole = user.role.toUpperCase();
    return allowedRoles.map(r => r.toUpperCase()).includes(userRole);
  }

  /**
   * Retorna true si el usuario actual debe cambiar su contraseña.
   * Se usa en firstLoginGuard para bloquear la navegación.
   */
  mustChangePasswordNow(): boolean {
    const user = this.currentUser();
    return user?.mustChangePassword === true;
  }

  /**
   * Actualiza el flag mustChangePassword en el estado local (localStorage + signal)
   * después de que el usuario cambia su contraseña exitosamente.
   */
  clearMustChangePassword(): void {
    const user = this.currentUser();
    if (user) {
      const updatedUser = { ...user, mustChangePassword: false };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.currentUser.set(updatedUser);
    }
  }

  changePassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, data);
  }
}
