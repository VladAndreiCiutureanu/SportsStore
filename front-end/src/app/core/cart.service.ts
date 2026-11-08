import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CartSummaryResponse } from './catalog.models';

/**
 * Cererile HTTP pentru cos (per utilizator, necesita token; backend-ul nu are cos anonim).
 * Starea cosului (sumar, livrare aleasa) o tine CartStore.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Sumarul cosului. Cu deliveryMethodId: 400 daca metoda nu e comuna tuturor produselor, 404 daca nu exista. */
  get(deliveryMethodId?: number | null): Observable<CartSummaryResponse> {
    return this.api.get<CartSummaryResponse>('Cart', { deliveryMethodId });
  }

  /** Adauga. Daca produsul e deja in cos, backend-ul ADUNA cantitatea si verifica totalul fata de stoc. */
  add(productId: number, quantity = 1): Observable<void> {
    return this.api.post<void>('Cart/items', { productId, quantity });
  }

  /** Seteaza cantitatea exacta (>= 1). 400 daca depaseste stocul, 404 daca produsul nu e in cos. */
  update(productId: number, quantity: number): Observable<void> {
    return this.api.put<void>(`Cart/items/${productId}`, { quantity });
  }

  remove(productId: number): Observable<void> {
    return this.api.delete<void>(`Cart/items/${productId}`);
  }

  /**
   * Un vizitator neautentificat nu poate avea cos: il trimitem la Login si,
   * dupa autentificare, il aducem inapoi pe pagina de unde a plecat.
   * Intoarce true daca utilizatorul e logat si poate continua.
   */
  requireLogin(): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    return false;
  }
}
