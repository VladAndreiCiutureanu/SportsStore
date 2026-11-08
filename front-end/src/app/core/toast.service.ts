import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/** Notificari scurte care apar in coltul ecranului si dispar singure. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(text: string, kind: ToastKind = 'info', durationMs = 4000): void {
    const toast: Toast = { id: this.nextId++, kind, text };
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  info(text: string): void {
    this.show(text, 'info');
  }

  warning(text: string): void {
    this.show(text, 'warning', 6000);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
