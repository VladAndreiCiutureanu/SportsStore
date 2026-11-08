import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Text suplimentar, afisat mai mic (ex. consecintele actiunii). */
  details?: string;
  confirmText?: string;
  cancelText?: string;
  /** true = butonul de confirmare e rosu (actiune distructiva, ex. stergere). */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Fereastra de confirmare "Esti sigur?". Se foloseste asa:
 *   if (await confirm.ask({ title: 'Sterge', message: '...', danger: true })) { ... }
 * Fereastra propriu-zisa este <app-confirm-dialog>, pusa o singura data in app.html.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    // Daca era deja o intrebare deschisa, o consideram anulata.
    this._pending()?.resolve(false);
    return new Promise((resolve) => this._pending.set({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    const current = this._pending();
    this._pending.set(null);
    current?.resolve(confirmed);
  }
}
