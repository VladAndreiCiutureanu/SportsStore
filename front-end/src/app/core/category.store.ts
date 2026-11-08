import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { CategoryRequest, CategoryResponse } from './catalog.models';
import { CategoryService } from './catalog.service';

/**
 * Sursa unica de categorii pentru toata aplicatia.
 *
 * Categoriile sunt 100% dinamice (le creeaza/modifica/sterge Admin-ul din interfata), asa ca
 * nu le scriem nicaieri in cod. Toate paginile (administrare categorii, formular produs,
 * lista produse, mai tarziu catalogul) citesc din acest store: cand Admin-ul adauga sau
 * redenumeste o categorie, schimbarea apare imediat peste tot, fara reincarcare.
 */
@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly api = inject(CategoryService);

  private readonly _items = signal<CategoryResponse[]>([]);
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<unknown>(null);
  private inFlight: Observable<CategoryResponse[]> | null = null;

  /** Categoriile, ordonate alfabetic (romaneste). */
  readonly items = computed(() => [...this._items()].sort(byName));
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isEmpty = computed(() => this._loaded() && this._items().length === 0);

  /**
   * Incarca lista de la server. Fara `force`, foloseste ce e deja incarcat.
   * Doua apeluri simultane impart aceeasi cerere HTTP.
   */
  load(force = false): Observable<CategoryResponse[]> {
    if (this._loaded() && !force) {
      return new Observable((sub) => {
        sub.next(this.items());
        sub.complete();
      });
    }
    if (this.inFlight) return this.inFlight;

    this._loading.set(true);
    this._error.set(null);
    this.inFlight = this.api.list().pipe(
      tap({
        next: (list) => {
          this._items.set(list);
          this._loaded.set(true);
        },
        error: (err) => this._error.set(err),
      }),
      map(() => this.items()),
      finalize(() => {
        this._loading.set(false);
        this.inFlight = null;
      }),
      shareReplay(1),
    );
    return this.inFlight;
  }

  /** Porneste incarcarea fara sa astepte rezultatul (pentru componente care citesc doar `items`). */
  ensureLoaded(): void {
    this.load().subscribe({ error: () => {} });
  }

  byId(id: number | null | undefined): CategoryResponse | undefined {
    return this._items().find((c) => c.id === id);
  }

  /** Exista deja o categorie cu acest nume? (serverul compara fara majuscule) */
  nameTaken(name: string, exceptId?: number): boolean {
    const normalized = normalize(name);
    return this._items().some((c) => c.id !== exceptId && normalize(c.name) === normalized);
  }

  create(request: CategoryRequest): Observable<CategoryResponse> {
    return this.api.create(request).pipe(tap((created) => this._items.update((list) => [...list, created])));
  }

  update(id: number, request: CategoryRequest): Observable<void> {
    return this.api
      .update(id, request)
      .pipe(tap(() => this._items.update((list) => list.map((c) => (c.id === id ? { ...c, ...request } : c)))));
  }

  delete(id: number): Observable<void> {
    return this.api.delete(id).pipe(tap(() => this._items.update((list) => list.filter((c) => c.id !== id))));
  }
}

export function normalize(name: string): string {
  return name.trim().toLocaleLowerCase('ro');
}

function byName(a: CategoryResponse, b: CategoryResponse): number {
  return a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' });
}
