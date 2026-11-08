import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';
import { getErrorMessage } from './api-error';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';
import { CartSummaryResponse } from './catalog.models';
import { ToastService } from './toast.service';

const DELIVERY_KEY = 'sportsstore.cart.delivery';

const EMPTY: CartSummaryResponse = {
  items: [],
  subtotal: 0,
  availableDeliveryMethods: [],
  deliveryMethod: null,
  deliveryCost: null,
  total: null,
};

/**
 * Starea cosului pentru tot site-ul (navbar, pagina Cos, mai tarziu Checkout).
 *
 * Reguli din backend respectate aici:
 * - Dupa ORICE schimbare (adaugare, cantitate, stergere) refacem GET /api/Cart, pentru ca
 *   subtotalul si metodele de livrare comune se pot schimba.
 * - Metoda de livrare aleasa se trimite ca ?deliveryMethodId=. Daca dupa o schimbare nu mai e
 *   comuna tuturor produselor (400) sau nu mai exista (404), o deselectam si cerem sumarul fara ea.
 * - Totalul il calculeaza serverul (subtotal + costul fix al livrarii); nu il recalculam noi.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly api = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly _summary = signal<CartSummaryResponse>(EMPTY);
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _deliveryId = signal<number | null>(null);
  /** Produsele pentru care o cerere e in curs (pentru spinner pe linie). */
  private readonly _busy = signal<ReadonlySet<number>>(new Set());

  readonly summary = this._summary.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly deliveryId = this._deliveryId.asReadonly();

  readonly items = computed(() => this._summary().items);
  readonly isEmpty = computed(() => this._loaded() && this.items().length === 0);
  /** Numarul total de bucati (pentru bulina din navbar). */
  readonly count = computed(() => this.items().reduce((sum, line) => sum + line.quantity, 0));
  /** Linii care nu mai pot fi comandate asa cum sunt (stoc 0 sau cantitate peste stocul actual). */
  readonly problems = computed(() => this.items().filter((l) => l.product.stock === 0 || l.quantity > l.product.stock));
  /** Produsele nu au nicio metoda de livrare comuna: comanda nu poate fi plasata. */
  readonly noCommonDelivery = computed(
    () => this.items().length > 0 && this._summary().availableDeliveryMethods.length === 0,
  );
  /** Poate merge la checkout: are produse, toate disponibile, si a ales livrarea. */
  readonly readyForCheckout = computed(
    () => this.items().length > 0 && this.problems().length === 0 && this._summary().deliveryMethod !== null,
  );

  constructor() {
    // Cosul e per utilizator: il incarcam la login / schimbare de cont si il golim la iesire.
    effect(() => {
      const userId = this.auth.session()?.userId ?? null;
      untracked(() => {
        if (userId) {
          this._deliveryId.set(readDelivery(userId));
          this.refresh().subscribe();
        } else {
          this.reset();
        }
      });
    });
  }

  isBusy(productId: number): boolean {
    return this._busy().has(productId);
  }

  /**
   * Reincarca sumarul, cu metoda de livrare aleasa (daca exista).
   * Erorile de livrare (400/404) sunt rezolvate aici: deselectam metoda si reincarcam fara ea.
   */
  refresh(): Observable<CartSummaryResponse | null> {
    this._loading.set(true);
    this._error.set(null);
    const deliveryId = this._deliveryId();

    return this.api.get(deliveryId).pipe(
      catchError((err) => {
        if (deliveryId !== null && (err?.status === 400 || err?.status === 404)) {
          const name = this._summary().availableDeliveryMethods.find((d) => d.id === deliveryId)?.name;
          this.setDelivery(null);
          this.toast.warning(
            name
              ? `„${name}” nu mai este disponibila pentru toate produsele din cos. Alege alta metoda de livrare.`
              : 'Metoda de livrare aleasa nu mai este disponibila. Alege alta.',
          );
          return this.api.get(null);
        }
        return throwError(() => err);
      }),
      tap((summary) => {
        this._summary.set(summary);
        this._loaded.set(true);
      }),
      catchError((err) => {
        if (err?.status !== 401) this._error.set(getErrorMessage(err)); // 401: interceptorul delogheaza
        return of(null);
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  /** Alege metoda de livrare si cere sumarul cu totalul calculat de server. */
  chooseDelivery(id: number | null): void {
    this.setDelivery(id);
    this.refresh().subscribe();
  }

  add(productId: number, quantity: number): Observable<void> {
    return this.mutate(productId, this.api.add(productId, quantity));
  }

  updateQuantity(productId: number, quantity: number): Observable<void> {
    return this.mutate(productId, this.api.update(productId, quantity));
  }

  remove(productId: number): Observable<void> {
    return this.mutate(productId, this.api.remove(productId));
  }

  /**
   * Trimite schimbarea si apoi reincarca sumarul (subtotal, livrari comune, total).
   * La eroare reincarcam oricum, ca utilizatorul sa vada stocul/cosul real, apoi propagam eroarea.
   */
  private mutate(productId: number, request: Observable<void>): Observable<void> {
    this.setBusy(productId, true);
    return request.pipe(
      switchMap(() => this.refresh()),
      map(() => undefined),
      catchError((err) => this.refresh().pipe(switchMap(() => throwError(() => err)))),
      finalize(() => this.setBusy(productId, false)),
    );
  }

  private setDelivery(id: number | null): void {
    this._deliveryId.set(id);
    const userId = this.auth.session()?.userId;
    if (userId) writeDelivery(userId, id);
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
    this._summary.set(EMPTY);
    this._loaded.set(false);
    this._error.set(null);
    this._deliveryId.set(null);
    this._busy.set(new Set());
  }
}

// Metoda de livrare aleasa o tinem minte pe durata sesiunii (per utilizator),
// ca sa ramana selectata dupa refresh si sa ajunga la checkout.
function readDelivery(userId: string): number | null {
  try {
    const raw = sessionStorage.getItem(`${DELIVERY_KEY}.${userId}`);
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeDelivery(userId: string, id: number | null): void {
  try {
    if (id === null) sessionStorage.removeItem(`${DELIVERY_KEY}.${userId}`);
    else sessionStorage.setItem(`${DELIVERY_KEY}.${userId}`, String(id));
  } catch {
    // stocare indisponibila: selectia ramane doar in memorie
  }
}
