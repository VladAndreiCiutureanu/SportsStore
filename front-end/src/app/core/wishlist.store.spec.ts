import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { installMemoryStorage } from '../testing/memory-storage';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { ProductResponse } from './catalog.models';
import { WishlistStore } from './wishlist.store';

const ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const product = (id: number, name = `P${id}`) => ({ id, name, stock: 1 }) as ProductResponse;

describe('WishlistStore', () => {
  let store: WishlistStore;
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    installMemoryStorage();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    store = TestBed.inject(WishlistStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function loginAndLoad(favorites: ProductResponse[]) {
    auth.login({ usernameOrEmail: 'ana', password: 'Parola123!' }).subscribe();
    http.expectOne('/api/Auth/login').flush({
      token: `${b64({})}.${b64({ [ROLE]: 'User' })}.x`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      userId: 'u1', username: 'ana', email: 'a@b.ro',
    });
    TestBed.tick(); // ruleaza effect-ul care incarca lista dupa login
    http.expectOne('/api/Wishlist').flush(favorites);
  }

  it('incarca favoritele dupa login si le goleste la logout', () => {
    loginAndLoad([product(1), product(2)]);
    expect(store.count()).toBe(2);
    expect(store.has(2)).toBe(true);

    auth.logout();
    TestBed.tick();
    expect(store.count()).toBe(0);
  });

  it('inima se umple imediat (optimist) si ramane plina daca serverul accepta', () => {
    loginAndLoad([]);
    store.toggle(product(5));
    expect(store.has(5)).toBe(true); // inainte de raspuns
    const req = http.expectOne('/api/Wishlist/5');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(store.has(5)).toBe(true);
  });

  it('revine daca serverul refuza adaugarea (ex. produs sters: 404)', () => {
    loginAndLoad([]);
    store.toggle(product(9));
    http.expectOne('/api/Wishlist/9').flush('Product not found.', { status: 404, statusText: 'Not Found' });
    expect(store.has(9)).toBe(false);
  });

  it('DELETE cu 404 (nu mai era in lista) e tratat ca succes', () => {
    loginAndLoad([product(3)]);
    store.toggle(product(3));
    const req = http.expectOne('/api/Wishlist/3');
    expect(req.request.method).toBe('DELETE');
    req.flush('Favorite product not found.', { status: 404, statusText: 'Not Found' });
    expect(store.has(3)).toBe(false);
  });

  it('readuce produsul daca stergerea esueaza din alt motiv', () => {
    loginAndLoad([product(1), product(2)]);
    store.toggle(product(1));
    http.expectOne('/api/Wishlist/1').flush(null, { status: 500, statusText: 'Server Error' });
    expect(store.items().map((p) => p.id)).toEqual([1, 2]); // pe aceeasi pozitie
  });

  it('vizitatorul este trimis la Login, fara cerere la server', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store.toggle(product(1));
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
    http.expectNone('/api/Wishlist/1');
  });
});
