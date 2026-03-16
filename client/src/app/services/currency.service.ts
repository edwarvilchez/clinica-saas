import { Injectable, signal, computed } from '@angular/core';

export type Currency = 'USD' | 'VES';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private currentCurrency = signal<Currency>('USD');
  private exchangeRate = signal<number>(60.00); // Tasa de ejemplo (BCV o paralelo)

  constructor() {
    const savedCurrency = localStorage.getItem('currency') as Currency;
    if (savedCurrency) {
      this.currentCurrency.set(savedCurrency);
    }
    const savedRate = localStorage.getItem('exchangeRate');
    if (savedRate) {
      this.exchangeRate.set(parseFloat(savedRate));
    }
  }

  get currency() {
    return this.currentCurrency.asReadonly();
  }

  get rate() {
    return this.exchangeRate.asReadonly();
  }

  setCurrency(currency: Currency) {
    this.currentCurrency.set(currency);
    localStorage.setItem('currency', currency);
  }

  setRate(rate: number) {
    this.exchangeRate.set(rate);
    localStorage.setItem('exchangeRate', rate.toString());
  }

  // Utilidad para convertir montos
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
