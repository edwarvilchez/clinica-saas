import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api-config';

export type Currency = 'USD' | 'VES';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private currentCurrency = signal<Currency>('USD');
  private exchangeRate = signal<number>(30.00);
  private rateSource = signal<'manual' | 'bcv' | 'default'>('default');
  private lastUpdated = signal<Date | null>(null);

  private readonly API_RATE_URL = `${API_URL}/exchange/bcv-rate`;

  constructor(private http: HttpClient) {
    const savedCurrency = localStorage.getItem('currency') as Currency;
    if (savedCurrency) {
      this.currentCurrency.set(savedCurrency);
    }

    // Restore last known rate immediately (survives API cold-start failures)
    const savedRate = localStorage.getItem('exchangeRate');
    if (savedRate) {
      const parsed = parseFloat(savedRate);
      if (parsed > 0) {
        this.exchangeRate.set(parsed);
        this.rateSource.set('manual');
      }
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
    const r = this.exchangeRate();
    return r > 0 ? r : 30.00;
  }

  get source() {
    return this.rateSource.asReadonly();
  }

  get updated() {
    return this.lastUpdated.asReadonly();
  }

  async fetchBcvRate(): Promise<number> {
    try {
      const response: any = await firstValueFrom(
        this.http.get(this.API_RATE_URL)
      );

      if (response?.rate && response.rate > 0) {
        this.exchangeRate.set(response.rate);
        this.rateSource.set(
          response.source === 'bcv' || response.source === 'er-api' ? 'bcv' : 'default'
        );
        this.lastUpdated.set(new Date(response.timestamp));
        localStorage.setItem('exchangeRate', response.rate.toString());
        return response.rate;
      }
    } catch {
      // Secondary service failure — silently use last-known rate from localStorage
    }

    // Return whatever we already have (default 30 or last-saved value)
    return this.exchangeRate();
  }

  async initializeRate(): Promise<void> {
    // Try BCV first, fallback to manual
    const savedRate = localStorage.getItem('exchangeRate');
    if (!savedRate) {
      // Only fetch if no manual rate is saved
      try {
        await this.fetchBcvRate();
      } catch {
        // Keep existing rate (30.00 default)
      }
    }
  }

  async refreshRate(): Promise<number> {
    // Force refresh from BCV API
    return await this.fetchBcvRate();
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