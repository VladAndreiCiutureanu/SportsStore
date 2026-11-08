import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { getErrorMessage } from '../../core/api-error';
import { DeliveryMethodResponse, ProductResponse } from '../../core/catalog.models';
import { DeliveryMethodService, ProductService } from '../../core/catalog.service';
import { CategoryStore } from '../../core/category.store';
import { LeiPipe } from '../../shared/lei.pipe';
import { ProductCard } from '../../shared/product-card';
import {
  CatalogFilters,
  DEFAULT_FILTERS,
  PAGE_SIZE,
  SORT_OPTIONS,
  activeFilterCount,
  apiKey,
  filtersFromParams,
  filtersToApi,
  filtersToParams,
  invalidPriceRange,
  sortProducts,
} from './catalog-filters';

type LoadResult = { products: ProductResponse[]; error: null } | { products: null; error: string };

/**
 * Catalogul public (pagina de start): categorii, cautare, filtre laterale, sortare, paginare.
 * Filtrarea o face serverul (GET /api/Product?...); sortarea si paginarea le facem aici,
 * pentru ca backend-ul intoarce lista intreaga, nepaginata.
 */
@Component({
  selector: 'app-catalog',
  imports: [FormsModule, ProductCard, LeiPipe],
  templateUrl: './catalog.html',
})
export class Catalog implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsApi = inject(ProductService);
  private readonly deliveryApi = inject(DeliveryMethodService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly categories = inject(CategoryStore);

  protected readonly sortOptions = SORT_OPTIONS;

  /** Filtrele curente, citite din URL. */
  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(filtersFromParams)), {
    initialValue: DEFAULT_FILTERS,
  });

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly results = signal<ProductResponse[]>([]);
  protected readonly deliveryMethods = signal<DeliveryMethodResponse[]>([]);
  protected readonly showFilters = signal(false); // pe telefon, filtrele sunt ascunse implicit

  // Campuri de text: le tinem local si actualizam URL-ul cu intarziere (nu la fiecare tasta).
  protected readonly searchText = signal('');
  protected readonly supplierText = signal('');
  protected readonly minPriceText = signal<number | null>(null);
  protected readonly maxPriceText = signal<number | null>(null);
  private readonly typing$ = new Subject<Partial<CatalogFilters>>();
  private editingText = false;

  // --- derivate ---
  protected readonly sorted = computed(() => sortProducts(this.results(), this.filters().sort));
  protected readonly total = computed(() => this.sorted().length);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  protected readonly page = computed(() => Math.min(this.filters().page, this.pageCount()));
  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.sorted().slice(start, start + PAGE_SIZE);
  });
  protected readonly pages = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1));
  protected readonly rangeLabel = computed(() => {
    if (!this.total()) return '';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    return `${start}-${Math.min(start + PAGE_SIZE - 1, this.total())} din ${this.total()}`;
  });

  protected readonly activeCount = computed(() => activeFilterCount(this.filters()));
  protected readonly currentCategory = computed(() => this.categories.byId(this.filters().category));
  protected readonly title = computed(() => this.currentCategory()?.name ?? 'Toate produsele');
  protected readonly priceRangeError = computed(() =>
    invalidPriceRange({ minPrice: this.minPriceText(), maxPrice: this.maxPriceText() }),
  );

  /** "Etichetele" filtrelor active, afisate deasupra grilei, fiecare cu X. */
  protected readonly chips = computed(() => {
    const f = this.filters();
    const chips: { label: string; clear: Partial<CatalogFilters> }[] = [];
    if (f.q) chips.push({ label: `Cautare: „${f.q}”`, clear: { q: '' } });
    if (this.currentCategory()) chips.push({ label: `Categorie: ${this.currentCategory()!.name}`, clear: { category: null } });
    if (f.minPrice !== null || f.maxPrice !== null) {
      const lei = new LeiPipe();
      const label =
        f.minPrice !== null && f.maxPrice !== null
          ? `${lei.transform(f.minPrice)} - ${lei.transform(f.maxPrice)}`
          : f.minPrice !== null
            ? `de la ${lei.transform(f.minPrice)}`
            : `pana la ${lei.transform(f.maxPrice)}`;
      chips.push({ label: `Pret: ${label}`, clear: { minPrice: null, maxPrice: null } });
    }
    if (f.availability !== 'all') {
      chips.push({ label: f.availability === 'in' ? 'Doar in stoc' : 'Doar indisponibile', clear: { availability: 'all' } });
    }
    if (f.supplier) chips.push({ label: `Furnizor: „${f.supplier}”`, clear: { supplier: '' } });
    for (const id of f.delivery) {
      const name = this.deliveryMethods().find((d) => d.id === id)?.name ?? `#${id}`;
      chips.push({ label: `Livrare: ${name}`, clear: { delivery: f.delivery.filter((x) => x !== id) } });
    }
    return chips;
  });

  constructor() {
    // Cand URL-ul se schimba din afara (Inapoi, link), aducem campurile de text la zi.
    effect(() => {
      const f = this.filters();
      if (this.editingText) return;
      this.searchText.set(f.q);
      this.supplierText.set(f.supplier);
      this.minPriceText.set(f.minPrice);
      this.maxPriceText.set(f.maxPrice);
    });
  }

  ngOnInit(): void {
    this.categories.ensureLoaded();
    this.deliveryApi.list().subscribe({ next: (list) => this.deliveryMethods.set(list), error: () => {} });

    // Cautare si furnizor: actualizam URL-ul dupa 350 ms fara tastare.
    this.typing$
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe((patch) => {
        this.update(patch, { replaceUrl: true });
        this.editingText = false;
      });

    // Reincarcam produsele doar cand se schimba filtrele trimise la server.
    // switchMap anuleaza cererea veche daca utilizatorul schimba repede filtrele.
    this.route.queryParamMap
      .pipe(
        map(filtersFromParams),
        distinctUntilChanged((a, b) => apiKey(a) === apiKey(b)),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((f) => {
          if (invalidPriceRange(f)) {
            return of<LoadResult>({ products: null, error: 'Pretul minim nu poate fi mai mare decat pretul maxim.' });
          }
          return this.productsApi.list(filtersToApi(f)).pipe(
            map((products): LoadResult => ({ products, error: null })),
            catchError((err) => of<LoadResult>({ products: null, error: getErrorMessage(err) })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result.error === null) {
          this.results.set(result.products);
        } else {
          this.results.set([]);
          this.error.set(result.error);
        }
      });
  }

  /** Schimba filtrele in URL. Orice filtru nou te duce inapoi la pagina 1. */
  protected update(patch: Partial<CatalogFilters>, options: { replaceUrl?: boolean } = {}): void {
    const next: CatalogFilters = { ...this.filters(), page: 1, ...patch };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtersToParams(next),
      replaceUrl: options.replaceUrl ?? false,
    });
  }

  protected onSearchInput(value: string): void {
    this.editingText = true;
    this.searchText.set(value);
    this.typing$.next({ q: value.trim() });
  }

  protected onSupplierInput(value: string): void {
    this.editingText = true;
    this.supplierText.set(value);
    this.typing$.next({ supplier: value.trim() });
  }

  protected applyPrice(): void {
    if (this.priceRangeError()) return;
    const min = this.minPriceText();
    const max = this.maxPriceText();
    const clean = (v: number | null) => (v === null || (v as unknown) === '' || v < 0 ? null : Number(v));
    this.update({ minPrice: clean(min), maxPrice: clean(max) });
  }

  protected toggleDelivery(id: number, checked: boolean): void {
    const current = this.filters().delivery;
    this.update({ delivery: checked ? [...current, id] : current.filter((x) => x !== id) });
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.pageCount() || page === this.page()) return;
    this.update({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected clearAll(): void {
    this.update({ ...DEFAULT_FILTERS, sort: this.filters().sort });
  }
}
