import { convertToParamMap } from '@angular/router';
import { ProductResponse } from '../../core/catalog.models';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  apiKey,
  filtersFromParams,
  filtersToApi,
  filtersToParams,
  invalidPriceRange,
  sortProducts,
} from './catalog-filters';

describe('catalog-filters', () => {
  it('citeste filtrele din URL si ignora valorile invalide', () => {
    const f = filtersFromParams(
      convertToParamMap({
        q: ' falcon xr ',
        category: '2',
        minPrice: '50',
        maxPrice: 'abc',
        availability: 'in',
        delivery: ['1', '3', 'x'],
        sort: 'price-desc',
        page: '0',
      }),
    );
    expect(f).toEqual({
      ...DEFAULT_FILTERS,
      q: 'falcon xr',
      category: 2,
      minPrice: 50,
      availability: 'in',
      delivery: [1, 3],
      sort: 'price-desc',
    });
  });

  it('URL-ul nu contine valorile implicite', () => {
    const params = filtersToParams({ ...DEFAULT_FILTERS, category: 3 });
    expect(Object.entries(params).filter(([, v]) => v !== null)).toEqual([['category', 3]]);
  });

  it('transforma filtrele in parametrii backend-ului (inStock, deliveryMethodIds)', () => {
    const api = filtersToApi({ ...DEFAULT_FILTERS, q: 'Falcon', availability: 'out', delivery: [20, 21], supplier: 'Furnizor X' });
    expect(api).toEqual({
      search: 'Falcon',
      categoryId: null,
      minPrice: null,
      maxPrice: null,
      inStock: false,
      supplier: 'Furnizor X',
      deliveryMethodIds: [20, 21],
    });
  });

  it('sortarea si pagina nu declanseaza o cerere noua la server', () => {
    expect(apiKey({ ...DEFAULT_FILTERS, sort: 'price-asc', page: 3 })).toBe(apiKey(DEFAULT_FILTERS));
    expect(apiKey({ ...DEFAULT_FILTERS, q: 'x' })).not.toBe(apiKey(DEFAULT_FILTERS));
  });

  it('detecteaza intervalul de pret invalid', () => {
    expect(invalidPriceRange({ minPrice: 300, maxPrice: 100 })).toBe(true);
    expect(invalidPriceRange({ minPrice: 100, maxPrice: 100 })).toBe(false);
    expect(invalidPriceRange({ minPrice: null, maxPrice: 5 })).toBe(false);
  });

  it('numara filtrele active', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, q: 'a', minPrice: 1, maxPrice: 2, delivery: [1, 2] })).toBe(3);
  });

  it('sorteaza local dupa pret, nume si noutate', () => {
    const p = (id: number, name: string, price: number) => ({ id, name, price }) as ProductResponse;
    const list = [p(1, 'Zebra', 50), p(2, 'Ancora', 200), p(3, 'Minge', 50)];
    expect(sortProducts(list, 'name').map((x) => x.id)).toEqual([2, 3, 1]);
    expect(sortProducts(list, 'price-asc').map((x) => x.id)).toEqual([3, 1, 2]);
    expect(sortProducts(list, 'price-desc').map((x) => x.id)).toEqual([2, 3, 1]);
    expect(sortProducts(list, 'newest').map((x) => x.id)).toEqual([3, 2, 1]);
  });
});
