import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-config';

@Injectable({
  providedIn: 'root'
})
export class MedicalService {
  private recordsUrl = `${API_URL}/medical-records`;
  private labsUrl = `${API_URL}/lab-results`;

  constructor(private http: HttpClient) { }

  private getHeaders() {
    return new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
  }

  getPatientHistory(patientId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.recordsUrl}/patient/${patientId}`, { headers: this.getHeaders() });
  }

  createRecord(record: any): Observable<any> {
    return this.http.post<any>(this.recordsUrl, record, { headers: this.getHeaders() });
  }

  getPatientLabs(patientId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.labsUrl}/patient/${patientId}`, { headers: this.getHeaders() });
  }

  getAllLabs(): Observable<any[]> {
    return this.http.get<any[]>(this.labsUrl, { headers: this.getHeaders() });
  }

  createLabResult(lab: any): Observable<any> {
    return this.http.post<any>(this.labsUrl, lab, { headers: this.getHeaders() });
  }
}
