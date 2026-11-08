import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { installMemoryStorage } from '../testing/memory-storage';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { CartStore } from './cart.store';
import { CartSummaryResponse, ProductResponse } from './catalog.models';

const ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');

const courier = { id: 1, name: 'Curier', cost: 19.99 };
const pickup = { id: 2, name: 'Ridicare', cost: 0 };
const product = (id: number, price: number, stock: number) =>
  ({ id, name: `P${id}`, price, stock, deliveryMethods: [courier, pickup] }) as unknown as ProductResponse;

function summary(lines: [ProductResponse, number][], delivery: typeof courier | null = null): CartSummaryResponse {
  const subtotal = lines.reduce((s, [p, q]) => s + p.price * q, 0);
  return {
    items: lines.map(([p, q]) => ({ product: p, quantity: q, lineTotal: p.price * q })),
    subtotal,
    availableDeliveryMethods: lines.length ? [courier, pickup] : [],
    deliveryMethod: delivery,
    deliveryCost: delivery?.cost ?? null,
    total: delivery ? subtotal + delivery.cost : null,
  };
}

describe('CartStore', () => {
  let store: CartStore;
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
    store = TestBed.inject(CartStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function loginWithCart(cart: CartSummaryResponse) {
    auth.login({ usernameOrEmail: 'ana', password: 'Parola123!' }).subscribe();
    http.expectOne('/api/Auth/login').flush({
      token: `${b64({})}.${b64({ [ROLE]: 'User' })}.x`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      userId: 'u1', username: 'ana', email: 'a@b.ro',
    });
    TestBed.tick();
    http.expectOne('/api/Cart').flush(cart);
  }

  it('incarca cosul la login si numara bucatile', () => {
    loginWithCart(summary([[product(1, 100, 5), 2], [product(2, 50, 5), 1]]));
    expect(store.count()).toBe(3);
    expect(store.summary().total).toBeNull(); // fara livrare aleasa, totalul e null
  });

  it('alegerea livrarii cere sumarul cu ?deliveryMethodId si foloseste totalul serverului', () => {
    loginWithCart(summary([[product(1, 100, 5), 1]]));
    store.chooseDelivery(1);
    http.expectOne('/api/Cart?deliveryMethodId=1').flush(summary([[product(1, 100, 5), 1]], courier));
    expect(store.summary().total).toBeCloseTo(119.99);
    expect(store.readyForCheckout()).toBe(true);
  });

  it('daca livrarea aleasa nu mai e comuna (400), o deselecteaza si reincarca fara ea', () => {
    loginWithCart(summary([[product(1, 100, 5), 1]]));
    store.chooseDelivery(1);
    http.expectOne('/api/Cart?deliveryMethodId=1').flush(
      'The selected delivery method is not available for every product in the cart.',
      { status: 400, statusText: 'Bad Request' },
    );
    http.expectOne('/api/Cart').flush(summary([[product(1, 100, 5), 1]]));
    expect(store.deliveryId()).toBeNull();
    expect(store.summary().deliveryMethod).toBeNull();
  });

  it('dupa schimbarea cantitatii reface GET-ul, pastrand livrarea aleasa', () => {
    loginWithCart(summary([[product(1, 100, 5), 1]]));
    store.chooseDelivery(2);
    http.expectOne('/api/Cart?deliveryMethodId=2').flush(summary([[product(1, 100, 5), 1]], pickup));

    store.updateQuantity(1, 3).subscribe();
    const put = http.expectOne('/api/Cart/items/1');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ quantity: 3 });
    put.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/Cart?deliveryMethodId=2').flush(summary([[product(1, 100, 5), 3]], pickup));
    expect(store.count()).toBe(3);
  });

  it('la stoc insuficient (400) reincarca cosul si propaga eroarea', () => {
    loginWithCart(summary([[product(1, 100, 2), 1]]));
    let failed = false;
    store.updateQuantity(1, 5).subscribe({ error: () => (failed = true) });
    http.expectOne('/api/Cart/items/1').flush('Only 2 item(s) are currently in stock.', { status: 400, statusText: 'Bad Request' });
    http.expectOne('/api/Cart').flush(summary([[product(1, 100, 2), 1]]));
    expect(failed).toBe(true);
  });

  it('semnaleaza produsele care nu mai pot fi comandate', () => {
    loginWithCart(summary([[product(1, 100, 0), 1], [product(2, 50, 1), 3], [product(3, 10, 9), 1]]));
    expect(store.problems().map((l) => l.product.id)).toEqual([1, 2]);
    expect(store.readyForCheckout()).toBe(false);
  });

  it('la logout cosul se goleste', () => {
    loginWithCart(summary([[product(1, 100, 5), 1]]));
    auth.logout();
    TestBed.tick();
    expect(store.count()).toBe(0);
    expect(store.loaded()).toBe(false);
  });
});
