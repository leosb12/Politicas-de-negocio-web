import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly toasts = signal<ToastItem[]>([]);

  private nextId = 1;

  success(title: string, message: string): void {
    this.push('success', title, message);
  }

  error(title: string, message: string): void {
    this.push('error', title, message);
  }

  info(title: string, message: string): void {
    this.push('info', title, message);
  }

  remove(id: number): void {
    this.toasts.update((items) => items.filter((item) => item.id !== id));
  }

  private push(type: ToastType, title: string, message: string): void {
    const id = this.nextId++;
    this.toasts.update((items) => [...items, { id, type, title, message }]);

    setTimeout(() => {
      this.remove(id);
    }, 4500);
  }
}
