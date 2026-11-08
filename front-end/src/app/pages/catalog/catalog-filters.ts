import { ParamMap, Params } from '@angular/router';
import { QueryParams } from '../../core/api.service';
import { ProductResponse } from '../../core/catalog.models';

/**
 * Starea catalogului. Traieste in URL (ex. /?category=2&q=falcon&minPrice=100&sort=price-asc),
 * ca un link sa poata fi trimis cuiva, iar butonul Inapoi al browserului sa functioneze.
 *
 * - Filtrele (categorie, cautare, pret, disponibilitate, furnizor, livrare) se trimit la server.
 * - Sortarea si pagina se aplica local: backend-ul nu sorteaza si nu pagineaza.
 */
export interface CatalogFilters {
  q: string;
  category: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  availability: 'all' | 'in' | 'out';
  supplier: string;
  delivery: number[];
  sort: SortKey;
  page: number;
}

export type SortKey = 'name' | 'price-asc' | 'price-desc' | 'newest';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Nume (A-Z)' },
  { key: 'price-asc', label: 'Pret crescator' },
  { key: 'price-desc', label: 'Pret descrescator' },
  { key: 'newest', label: 'Cele mai noi' },
];

export const PAGE_SIZE = 12;

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  category: null,
  minPrice: null,
  maxPrice: null,
  availability: 'all',
  supplier: '',
  delivery: [],
  sort: 'name',
  page: 1,
};

/** URL -> filtre. Valorile invalide din URL sunt ignorate (nu stricam pagina pentru un link gresit). */
export function filtersFromParams(params: ParamMap): CatalogFilters {
  const num = (key: string, min = 0): number | null => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= min ? n : null;
  };
  const availability = params.get('availability');
  const sort = params.get('sort') as SortKey | null;
  const page = Number(params.get('page'));

  return {
    q: (params.get('q') ?? '').trim(),
    category: num('category', 1),
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    availability: availability === 'in' || availability === 'out' ? availability : 'all',
    supplier: (params.get('supplier') ?? '').trim(),
    delivery: params
      .getAll('delivery')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0),
    sort: SORT_OPTIONS.some((o) => o.key === sort) ? sort! : 'name',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Filtre -> URL. Valorile implicite nu apar in URL, ca adresa sa ramana curata. */
export function filtersToParams(f: CatalogFilters): Params {
  return {
    q: f.q || null,
    category: f.category,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    availability: f.availability === 'all' ? null : f.availability,
    supplier: f.supplier || null,
    delivery: f.delivery.length ? f.delivery : null,
    sort: f.sort === 'name' ? null : f.sort,
    page: f.page > 1 ? f.page : null,
  };
}

/** Pretul minim e mai mare decat cel maxim? (backend-ul ar raspunde 400) */
export function invalidPriceRange(f: Pick<CatalogFilters, 'minPrice' | 'maxPrice'>): boolean {
  return f.minPrice !== null && f.maxPrice !== null && f.minPrice > f.maxPrice;
}

/**
 * Filtre -> parametrii pentru GET /api/Product.
 * Criteriile diferite se combina cu AND pe server; mai multe livrari = OR intre ele.
 * Encoding-ul (spatii, diacritice) il face HttpParams in ApiService.
 */
export function filtersToApi(f: CatalogFilters): QueryParams {
  return {
    search: f.q || null,
    categoryId: f.category,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    inStock: f.availability === 'all' ? null : f.availability === 'in',
    supplier: f.supplier || null,
    deliveryMethodIds: f.delivery,
  };
}

/** Cheie care se schimba doar cand se schimba ceva ce merge la server (nu sortarea/pagina). */
export function apiKey(f: CatalogFilters): string {
  return JSON.stringify(filtersToApi(f));
}

export function sortProducts(list: ProductResponse[], sort: SortKey): ProductResponse[] {
  const sorted = [...list];
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price || byName(a, b));
    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price || byName(a, b));
    case 'newest':
      return sorted.sort((a, b) => b.id - a.id); // id mai mare = adaugat mai recent
    default:
      return sorted.sort(byName);
  }
}

/** Numarul de filtre active (fara sortare/pagina), pentru eticheta "Filtre (3)". */
export function activeFilterCount(f: CatalogFilters): number {
  return [
    f.q,
    f.category,
    f.minPrice !== null || f.maxPrice !== null,
    f.availability !== 'all',
    f.supplier,
    f.delivery.length,
  ].filter(Boolean).length;
}

function byName(a: ProductResponse, b: ProductResponse): number {
  return a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' });
}
