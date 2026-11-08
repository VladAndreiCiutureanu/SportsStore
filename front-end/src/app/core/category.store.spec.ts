import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CategoryStore } from './category.store';
import { toProductRequest } from './catalog.service';

describe('CategoryStore', () => {
  let store: CategoryStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(CategoryStore);
    http = TestBed.inject(HttpTestingController);
    store.load().subscribe();
    http.expectOne('/api/Category').flush([
      { id: 2, name: 'Fitness', description: null },
      { id: 1, name: 'Alergare', description: 'Pantofi' },
    ]);
  });

  afterEach(() => http.verify());

  it('incarca si sorteaza alfabetic', () => {
    expect(store.items().map((c) => c.name)).toEqual(['Alergare', 'Fitness']);
  });

  it('nu repeta cererea daca lista e deja incarcata', () => {
    store.load().subscribe();
    http.expectNone('/api/Category');
  });

  it('detecteaza numele duplicate fara majuscule si spatii', () => {
    expect(store.nameTaken('  alergare ')).toBe(true);
    expect(store.nameTaken('Ciclism')).toBe(false);
    expect(store.nameTaken('Alergare', 1)).toBe(false); // e chiar categoria editata
  });

  it('actualizeaza lista dupa adaugare, redenumire si stergere', () => {
    store.create({ name: 'Ciclism', description: null }).subscribe();
    http.expectOne({ method: 'POST', url: '/api/Category' }).flush({ id: 3, name: 'Ciclism', description: null });
    expect(store.items().map((c) => c.name)).toEqual(['Alergare', 'Ciclism', 'Fitness']);

    store.update(2, { name: 'Antrenament', description: null }).subscribe();
    http.expectOne({ method: 'PUT', url: '/api/Category/2' }).flush(null, { status: 204, statusText: 'No Content' });
    expect(store.byId(2)?.name).toBe('Antrenament');

    store.delete(1).subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/Category/1' }).flush(null, { status: 204, statusText: 'No Content' });
    expect(store.items().map((c) => c.id)).toEqual([2, 3]);
  });
});

describe('toProductRequest', () => {
  it('copiaza produsul complet si schimba doar ce ii ceri (PUT fara pierderi)', () => {
    const request = toProductRequest(
      {
        id: 9, name: 'Minge', description: 'd', specifications: 's', price: 50, stock: 3, supplier: 'X',
        imageUrl: null, categoryId: 1, categoryName: 'A',
        deliveryMethods: [{ id: 4, name: 'Curier', cost: 10 }],
      },
      { categoryId: 7 },
    );
    expect(request).toEqual({
      name: 'Minge', description: 'd', specifications: 's', price: 50, stock: 3, supplier: 'X',
      imageUrl: null, categoryId: 7, deliveryMethodIds: [4],
    });
  });
});
