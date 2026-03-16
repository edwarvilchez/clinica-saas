import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-config';

export interface LabTest {
  id?: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isActive: boolean;
}

export interface LabCombo {
  id?: string;
  name: string;
  description?: string;
  totalPrice: number;
  isActive: boolean;
  tests?: LabTest[];
  testIds?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LabCatalogService {
  private apiUrl = `${API_URL}/lab-catalog`;

  constructor(private http: HttpClient) {}

  // Tests
  getTests(): Observable<LabTest[]> {
    return this.http.get<LabTest[]>(`${this.apiUrl}/tests`);
  }

  createTest(test: LabTest): Observable<LabTest> {
    return this.http.post<LabTest>(`${this.apiUrl}/tests`, test);
  }

  updateTest(id: string, test: Partial<LabTest>): Observable<LabTest> {
    return this.http.put<LabTest>(`${this.apiUrl}/tests/${id}`, test);
  }

  deleteTest(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tests/${id}`);
  }

  importTests(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/import-tests`, formData);
  }

  // Combos
  getCombos(): Observable<LabCombo[]> {
    return this.http.get<LabCombo[]>(`${this.apiUrl}/combos`);
  }

  createCombo(combo: LabCombo): Observable<LabCombo> {
    return this.http.post<LabCombo>(`${this.apiUrl}/combos`, combo);
  }

  updateCombo(id: string, combo: Partial<LabCombo>): Observable<LabCombo> {
    return this.http.put<LabCombo>(`${this.apiUrl}/combos/${id}`, combo);
  }

  deleteCombo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/combos/${id}`);
  }
}
