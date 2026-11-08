import { Injectable, inject, signal } from '@angular/core';
import { getErrorMessage } from '../core/api-error';
import { CartService } from '../core/cart.service';
import { CartStore } from '../core/cart.store';
import { ProductResponse } from '../core/catalog.models';
import { ToastService } from '../core/toast.service';

/**
 * Logica butonului "Adauga in cos", comuna pentru cardul din catalog si pagina de detalii:
 * - produs fara stoc: nu se trimite nimic (butonul e oricum dezactivat);
 * - vizitator: trimis la Login, apoi intors aici;
 * - eroare de stoc de la server: mesaj clar.
 * Dupa adaugare, CartStore reincarca sumarul, deci bulina din navbar se actualizeaza singura.
 */
@Injectable({ providedIn: 'root' })
export class AddToCart {
  private readonly cartApi = inject(CartService);
  private readonly cart = inject(CartStore);
  private readonly toast = inject(ToastService);

  /** Id-ul produsului care se adauga acum (pentru spinner), sau null. */
  readonly addingId = signal<number | null>(null);

  add(product: ProductResponse, quantity = 1, onSuccess?: () => void): void {
    if (product.stock === 0 || this.addingId() !== null) return;
    if (!this.cartApi.requireLogin()) {
      this.toast.info('Autentifica-te ca sa adaugi produse in cos.');
      return;
    }

    this.addingId.set(product.id);
    this.cart.add(product.id, quantity).subscribe({
      next: () => {
        this.addingId.set(null);
        this.toast.success(
          quantity === 1 ? `„${product.name}” a fost adaugat in cos.` : `${quantity} × „${product.name}” au fost adaugate in cos.`,
        );
        onSuccess?.();
      },
      error: (err) => {
        this.addingId.set(null);
        this.toast.show(getErrorMessage(err), 'danger', 6000);
      },
    });
  }
}
