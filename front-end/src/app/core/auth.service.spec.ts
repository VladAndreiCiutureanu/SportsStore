import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { installMemoryStorage } from '../testing/memory-storage';

const ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const KEY = 'sportsstore.session';

/** Construieste un JWT fals (fara semnatura valida) cu claim-urile date. */
function fakeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.semnatura`;
}

function loginResponse(roles: string | string[], expiresInMs = 3_600_000) {
  return {
    token: fakeJwt({ [ROLE]: roles }),
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    userId: 'u1',
    username: 'ana',
    email: 'ana@example.test',
  };
}

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let storage: { local: Storage; session: Storage };

  beforeEach(() => {
    storage = installMemoryStorage();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule(); // opreste ceasul sesiunii
  });

  function login(roles: string | string[], remember = true) {
    auth.login({ usernameOrEmail: 'ana', password: 'Parola123!' }, remember).subscribe();
    http.expectOne('/api/Auth/login').flush(loginResponse(roles));
  }

  it('citeste un singur rol (text) din token', () => {
    login('User');
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.session()?.roles).toEqual(['User']);
  });

  it('citeste mai multe roluri (lista) din token si recunoaste Admin', () => {
    login(['Admin', 'User']);
    expect(auth.isAdmin()).toBe(true);
  });

  it('"Tine-ma minte" salveaza in localStorage, fara parola', () => {
    login('User', true);
    const stored = storage.local.getItem(KEY) ?? '';
    expect(stored).toContain('ana');
    expect(stored).not.toContain('Parola123');
    expect(storage.session.getItem(KEY)).toBeNull();
  });

  it('fara "Tine-ma minte" salveaza doar in sessionStorage', () => {
    login('User', false);
    expect(storage.session.getItem(KEY)).toContain('ana');
    expect(storage.local.getItem(KEY)).toBeNull();
  });

  it('logout sterge sesiunea din ambele locuri', () => {
    login('User');
    auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
    expect(storage.local.getItem(KEY)).toBeNull();
    expect(storage.session.getItem(KEY)).toBeNull();
  });

  it('calculeaza timpul ramas si avertizeaza cu 5 minute inainte', () => {
    auth.login({ usernameOrEmail: 'ana', password: 'Parola123!' }).subscribe();
    http.expectOne('/api/Auth/login').flush(loginResponse('User', 4 * 60 * 1000));
    expect(auth.secondsLeft()).toBeGreaterThan(200);
    expect(auth.expiresSoon()).toBe(true);
  });

  it('reautentificarea face login cu utilizatorul curent', () => {
    login('User');
    auth.reauthenticate('Parola123!').subscribe();
    const req = http.expectOne('/api/Auth/login');
    expect(req.request.body).toEqual({ usernameOrEmail: 'ana', password: 'Parola123!' });
    req.flush(loginResponse('User'));
  });

  it('adauga headerul Authorization la cererile catre API', () => {
    login('User');
    TestBed.inject(HttpClient).get('/api/Cart').subscribe();
    const req = http.expectOne('/api/Cart');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${auth.token}`);
    req.flush({});
  });

  it('la 401 pe o cerere protejata sterge sesiunea', () => {
    login('User');
    TestBed.inject(HttpClient).get('/api/Cart').subscribe({ error: () => {} });
    http.expectOne('/api/Cart').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('la 401 pe login (parola gresita) doar intoarce eroarea', () => {
    let failed = false;
    auth.login({ usernameOrEmail: 'ana', password: 'gresit123' }).subscribe({ error: () => (failed = true) });
    http
      .expectOne('/api/Auth/login')
      .flush({ error: 'Invalid username/email or password.' }, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBe(true);
    expect(auth.isLoggedIn()).toBe(false);
  });
});
