import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { getErrorMessage } from './api-error';
import { AuthService } from './auth.service';
import { ProductResponse } from './catalog.models';
import { ToastService } from './toast.service';

/**
 * Produsele favorite ale utilizatorului logat (GET/POST/DELETE /api/Wishlist).
 *
 * - Lista e per utilizator si cere login. Se incarca automat la autentificare si se goleste la iesire.
 * - Inima se schimba IMEDIAT la click ("optimist"); daca serverul refuza, revenim si afisam eroarea.
 * - POST e idempotent (204 si a doua oara). DELETE pe ceva ce nu mai e in lista raspunde 404:
 *   rezultatul dorit e acelasi, deci il tratam ca succes.
 */
@Injectable({ providedIn: 'root' })
export class WishlistStore {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly _items = signal<ProductResponse[]>([]);
  private readonly _ids = signal<ReadonlySet<number>>(new Set());
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _busy = signal<ReadonlySet<number>>(new Set());

  /** Produsele favorite, in ordinea in care le-a adaugat utilizatorul in aceasta sesiune (cele noi primele). */
  readonly items = this._items.asReadonly();
  readonly count = computed(() => this._ids().size);
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();

  constructor() {
    // Cand se schimba utilizatorul (login, logout, alt cont, alt tab) reincarcam lista lui.
    effect(() => {
      const userId = this.auth.session()?.userId ?? null;
      untracked(() => (userId ? this.load() : this.reset()));
    });
  }

  has(productId: number): boolean {
    return this._ids().has(productId);
  }

  /** Se trimite o cerere pentru acest produs chiar acum? (pentru a dezactiva butonul) */
  isBusy(productId: number): boolean {
    return this._busy().has(productId);
  }

  load(): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<ProductResponse[]>('Wishlist').subscribe({
      next: (list) => {
        this._items.set(list);
        this._ids.set(new Set(list.map((p) => p.id)));
        this._loaded.set(true);
        this._loading.set(false);
      },
      error: (err) => {
        this._loading.set(false);
        // La 401 interceptorul se ocupa deja de delogare.
        if (err?.status !== 401) this._error.set(getErrorMessage(err));
      },
    });
  }

  /** Adauga sau scoate produsul din favorite. Vizitatorul este trimis la Login. */
  toggle(product: ProductResponse): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.info('Autentifica-te ca sa-ti salvezi produsele favorite.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.isBusy(product.id)) return;
    if (this.has(product.id)) this.remove(product);
    else this.add(product);
  }

  add(product: ProductResponse): void {
    this.setBusy(product.id, true);
    this.applyAdd(product);

    this.api.post<void>(`Wishlist/${product.id}`).subscribe({
      next: () => {
        this.setBusy(product.id, false);
        this.toast.success(`„${product.name}” a fost adaugat la favorite.`);
      },
      error: (err) => {
        this.setBusy(product.id, false);
        this.applyRemove(product.id); // revenim
        this.toast.show(
          err?.status === 404 ? 'Produsul nu mai exista in magazin.' : getErrorMessage(err),
          'danger',
          6000,
        );
      },
    });
  }

  remove(product: ProductResponse): void {
    const index = this._items().findIndex((p) => p.id === product.id);
    this.setBusy(product.id, true);
    this.applyRemove(product.id);

    this.api.delete<void>(`Wishlist/${product.id}`).subscribe({
      next: () => {
        this.setBusy(product.id, false);
        this.toast.info(`„${product.name}” a fost scos de la favorite.`);
      },
      error: (err) => {
        this.setBusy(product.id, false);
        if (err?.status === 404) return; // nu mai era in lista: exact ce voiam
        this.applyAdd(product, index); // revenim pe aceeasi pozitie
        this.toast.show(getErrorMessage(err), 'danger', 6000);
      },
    });
  }

  // ---------------------------------------------------------------------------

  private applyAdd(product: ProductResponse, index = 0): void {
    if (this._ids().has(product.id)) return;
    this._ids.update((ids) => new Set(ids).add(product.id));
    this._items.update((list) => {
      const copy = [...list];
      copy.splice(Math.max(0, Math.min(index, copy.length)), 0, product);
      return copy;
    });
  }

  private applyRemove(productId: number): void {
    this._ids.update((ids) => {
      const next = new Set(ids);
      next.delete(productId);
      return next;
    });
    this._items.update((list) => list.filter((p) => p.id !== productId));
  }

  private setBusy(productId: number, busy: boolean): void {
    this._busy.update((set) => {
      const next = new Set(set);
      if (busy) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }

  private reset(): void {
    this._items.set([]);
    this._ids.set(new Set());
    this._busy.set(new Set());
    this._loaded.set(false);
    this._error.set(null);
  }
}
