import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  Session,
} from './auth.models';
import { ToastService } from './toast.service';

const STORAGE_KEY = 'sportsstore.session';

// ASP.NET pune rolurile in JWT sub acest nume lung de claim.
// Valoarea este un text ("User") daca e un singur rol, sau o lista (["Admin","User"]) daca sunt mai multe.
const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/** Cu cate secunde inainte de expirare avertizam utilizatorul. */
export const EXPIRY_WARNING_SECONDS = 5 * 60;

/**
 * Tine evidenta utilizatorului logat, ca intr-o aplicatie reala:
 *
 * - "Tine-ma minte": sesiunea se pastreaza in localStorage (ramai logat si dupa ce inchizi browserul);
 *   altfel in sessionStorage (se sterge cand inchizi browserul). Parola nu se salveaza niciodata.
 * - Rolul se citeste din token, DOAR pentru afisare. Serverul verifica oricum rolul la fiecare cerere.
 * - Tokenul expira dupa ~1 ora si backend-ul nu are "refresh token". De aceea:
 *   cu 5 minute inainte afisam un avertisment si cerem parola din nou (un login nou = token nou);
 *   la expirare stergem sesiunea si trimitem utilizatorul la Login.
 * - Sincronizare intre tab-uri: daca te deloghezi intr-un tab, esti delogat in toate.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly _session = signal<Session | null>(null);
  private readonly now = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | undefined;

  /** Sesiunea curenta sau null daca nu e nimeni logat. */
  readonly session = this._session.asReadonly();
  readonly isLoggedIn = computed(() => this._session() !== null);
  readonly isAdmin = computed(() => this._session()?.roles.includes('Admin') ?? false);
  readonly username = computed(() => this._session()?.username ?? null);

  /** Secunde ramase pana la expirarea tokenului (0 daca nu esti logat). Se actualizeaza la fiecare secunda. */
  readonly secondsLeft = computed(() => {
    const s = this._session();
    if (!s) return 0;
    return Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - this.now()) / 1000));
  });
  readonly expiresSoon = computed(
    () => this.isLoggedIn() && this.secondsLeft() <= EXPIRY_WARNING_SECONDS,
  );

  constructor() {
    this.restoreSession();

    // Alt tab a schimbat sesiunea (login/logout) -> o preluam si aici.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) this.syncFromOtherTab(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('storage', onStorage);
      this.stopTicker();
    });
  }

  /** Tokenul pentru headerul Authorization, sau null. */
  get token(): string | null {
    return this._session()?.token ?? null;
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.api.post<RegisterResponse>('Auth/register', request);
  }

  /** Login. `remember` decide daca sesiunea supravietuieste inchiderii browserului. */
  login(request: LoginRequest, remember = true): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse>('Auth/login', request)
      .pipe(tap((response) => this.startSession(response, remember)));
  }

  /**
   * Prelungeste sesiunea: backend-ul nu are refresh token, deci facem un login nou
   * cu utilizatorul curent si parola introdusa din nou.
   */
  reauthenticate(password: string): Observable<LoginResponse> {
    const current = this._session();
    if (!current) throw new Error('Nu exista o sesiune de prelungit.');
    return this.login({ usernameOrEmail: current.username, password }, current.remember);
  }

  /** Iesire din cont: sterge tot ce tine de sesiune din browser. */
  logout(): void {
    const name = this.username();
    this.clearSession();
    this.router.navigateByUrl('/');
    this.toast.info(name ? `Te-ai deconectat. La revedere, ${name}!` : 'Te-ai deconectat.');
  }

  /**
   * Apelat de interceptor cand serverul raspunde 401 si de timer cand expira tokenul:
   * stergem sesiunea si trimitem utilizatorul la Login, cu intoarcere la pagina curenta.
   */
  handleUnauthorized(): void {
    if (!this._session()) return;
    const returnUrl = this.router.url.startsWith('/login') ? undefined : this.router.url;
    this.clearSession();
    this.router.navigate(['/login'], { queryParams: { returnUrl, expired: 1 } });
  }

  // ---------------------------------------------------------------------------

  private startSession(response: LoginResponse, remember: boolean): void {
    this.saveSession({
      token: response.token,
      expiresAt: response.expiresAt,
      userId: response.userId,
      username: response.username,
      email: response.email,
      roles: readRoles(response.token),
      remember,
    });
  }

  private restoreSession(): void {
    // Cautam intai sesiunea temporara (tab-ul curent), apoi pe cea "tine-ma minte".
    const session = readStored(sessionStorage) ?? readStored(localStorage);
    if (session && !isExpired(session)) {
      this.saveSession(session);
    } else {
      this.clearSession();
    }
  }

  private saveSession(session: Session): void {
    this._session.set(session);
    const target = session.remember ? localStorage : sessionStorage;
    const other = session.remember ? sessionStorage : localStorage;
    safe(() => other.removeItem(STORAGE_KEY));
    safe(() => target.setItem(STORAGE_KEY, JSON.stringify(session)));
    this.startTicker();
  }

  private clearSession(): void {
    this.stopTicker();
    this._session.set(null);
    safe(() => localStorage.removeItem(STORAGE_KEY));
    safe(() => sessionStorage.removeItem(STORAGE_KEY));
  }

  /** Ceasul care actualizeaza secondsLeft si delogheaza la expirare. */
  private startTicker(): void {
    this.stopTicker();
    this.now.set(Date.now());
    this.ticker = setInterval(() => {
      this.now.set(Date.now());
      if (this.isLoggedIn() && this.secondsLeft() === 0) {
        this.toast.warning('Sesiunea a expirat. Autentifica-te din nou.');
        this.handleUnauthorized();
      }
    }, 1000);
  }

  private stopTicker(): void {
    clearInterval(this.ticker);
    this.ticker = undefined;
  }

  private syncFromOtherTab(raw: string | null): void {
    const incoming = raw ? parseSession(raw) : null;

    if (incoming && !isExpired(incoming)) {
      const wasLoggedIn = this.isLoggedIn();
      this._session.set(incoming);
      this.startTicker();
      if (!wasLoggedIn) this.toast.info(`Conectat ca ${incoming.username} (din alt tab).`);
      return;
    }

    if (this.isLoggedIn()) {
      this.stopTicker();
      this._session.set(null);
      this.toast.info('Te-ai deconectat in alt tab.');
      // Daca pagina curenta cere autentificare, plecam de pe ea.
      if (requiresAuth(this.router.routerState.snapshot.root)) {
        this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      }
    }
  }
}

// --- functii ajutatoare ------------------------------------------------------

function safe(action: () => void): void {
  try {
    action();
  } catch {
    // stocare indisponibila (ex. mod privat): sesiunea ramane doar in memorie
  }
}

function readStored(storage: Storage): Session | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? parseSession(raw) : null;
  } catch {
    return null;
  }
}

function parseSession(raw: string): Session | null {
  try {
    const s = JSON.parse(raw) as Session;
    return s && typeof s.token === 'string' ? { ...s, remember: s.remember ?? true } : null;
  } catch {
    return null;
  }
}

function isExpired(session: Session): boolean {
  const expires = new Date(session.expiresAt).getTime();
  return Number.isNaN(expires) || expires <= Date.now();
}

/** Ruta curenta (sau una dintre parinti) are `data: { auth: ... }`? */
function requiresAuth(route: ActivatedRouteSnapshot): boolean {
  let current: ActivatedRouteSnapshot | null = route;
  while (current) {
    if (current.data['auth']) return true;
    current = current.firstChild;
  }
  return false;
}

/** Citeste rolurile din partea a doua (payload) a tokenului JWT. Nu verifica semnatura. */
export function readRoles(token: string): string[] {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

    const value = claims[ROLE_CLAIM] ?? claims['role'];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return [value];
    return [];
  } catch {
    return [];
  }
}
