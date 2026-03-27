import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Currency = 'USD' | 'VES';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private currentCurrency = signal<Currency>('USD');
  private exchangeRate = signal<number>(30.00);
  private rateSource = signal<'manual' | 'bcv' | 'default'>('default');
  private lastUpdated = signal<Date | null>(null);

  private readonly API_URL = '/api/exchange/bcv-rate';

  constructor(private http: HttpClient) {
    const savedCurrency = localStorage.getItem('currency') as Currency;
    if (savedCurrency) {
      this.currentCurrency.set(savedCurrency);
    }
    
    const savedRate = localStorage.getItem('exchangeRate');
    if (savedRate) {
      this.exchangeRate.set(parseFloat(savedRate));
      this.rateSource.set('manual');
    }
  }

  get currency() {
    return this.currentCurrency.asReadonly();
  }

  setCurrency(currency: Currency) {
    this.currentCurrency.set(currency);
    localStorage.setItem('currency', currency);
  }

  get rate() {
    return this.exchangeRate.asReadonly();
  }

  get source() {
    return this.rateSource.asReadonly();
  }

  get updated() {
    return this.lastUpdated.asReadonly();
  }

  async fetchBcvRate(): Promise<number> {
    try {
      const response: any = await firstValueFrom(this.http.get(this.API_URL));
      
      if (response && response.rate) {
        this.exchangeRate.set(response.rate);
        this.rateSource.set(response.source === 'bcv' ? 'bcv' : 'default');
        this.lastUpdated.set(new Date(response.timestamp));
        localStorage.setItem('exchangeRate', response.rate.toString());
        
        return response.rate;
      }
    } catch (error) {
      console.warn('No se pudo obtener tasa del BCV:', error);
    }
    
    // Return current rate if fetch fails
    return this.exchangeRate();
  }

  async initializeRate(): Promise<void> {
    // Try BCV first, fallback to manual
    try {
      await this.fetchBcvRate();
    } catch {
      // Keep existing rate
    }
  }

  setRate(rate: number) {
    this.exchangeRate.set(rate);
    this.rateSource.set('manual');
    this.lastUpdated.set(new Date());
    localStorage.setItem('exchangeRate', rate.toString());
  }

  convert(amount: number, from: Currency, to: Currency): number {
    if (from === to) return amount;
    if (from === 'USD' && to === 'VES') return amount * this.exchangeRate();
    if (from === 'VES' && to === 'USD') return amount / this.exchangeRate();
    return amount;
  }

  formatAmount(amount: number, currency?: Currency): string {
    const targetCurrency = currency || this.currentCurrency();
    const converted = this.convert(amount, 'USD', targetCurrency);
    
    return new Intl.NumberFormat(targetCurrency === 'USD' ? 'en-US' : 'es-VE', {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: 2
    }).format(converted);
  }
}