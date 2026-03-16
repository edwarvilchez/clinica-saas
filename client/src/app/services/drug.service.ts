import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api-config';

export interface Drug {
  id?: number;
  name: string;
  genericName?: string;
  activeComponents: string;
  indications?: string;
  posology?: string;
  contraindications?: string;
  adverseReactions?: string;
  precautions?: string;
  presentation?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DrugResponse {
  total: number;
  drugs: Drug[];
  limit: number;
  offset: number;
}

@Injectable({
  providedIn: 'root'
})
export class DrugService {
  private apiUrl = `${API_URL}/drugs`;

  constructor(private http: HttpClient) {}

  getAll(params: any = {}): Observable<DrugResponse> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key]) {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<DrugResponse>(this.apiUrl, { params: httpParams });
  }

  getById(id: number): Observable<Drug> {
    return this.http.get<Drug>(`${this.apiUrl}/${id}`);
  }

  create(drug: Drug): Observable<Drug> {
    return this.http.post<Drug>(this.apiUrl, drug);
  }

  update(id: number, drug: Drug): Observable<Drug> {
    return this.http.put<Drug>(`${this.apiUrl}/${id}`, drug);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
