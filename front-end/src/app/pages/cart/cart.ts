import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api-error';
import { CartStore } from '../../core/cart.store';
import { CartLineResponse } from '../../core/catalog.models';
import { ToastService } from '../../core/toast.service';
import { LeiPipe } from '../../shared/lei.pipe';

/** Cate bucati se pot alege dintr-un produs pe pagina cosului (limita de bun-simt). */
const MAX_PER_LINE = 99;

/**
 * Pagina "Cos" (/cart), necesita login.
 * Toate sumele (linii, subtotal, livrare, total) vin de la server; dupa fiecare schimbare
 * CartStore reface GET /api/Cart, cu metoda de livrare aleasa.
 */
@Component({
  selector: 'app-cart',
  imports: [RouterLink, LeiPipe],
  templateUrl: './cart.html',
})
export class Cart implements OnInit {
  protected readonly cart = inject(CartStore);
  private readonly toast = inject(ToastService);

  protected readonly summary = this.cart.summary;
  protected readonly itemCount = computed(() => this.cart.count());

  ngOnInit(): void {
    // La intrarea pe pagina luam date proaspete (preturile sau stocul se pot schimba).
    // Daca abia s-a logat, CartStore il incarca deja: nu mai trimitem inca o cerere.
    if (this.cart.loaded() && !this.cart.loading()) this.cart.refresh().subscribe();
  }

  protected maxFor(line: CartLineResponse): number {
    return Math.max(1, Math.min(line.product.stock, MAX_PER_LINE));
  }

  protected tooMany(line: CartLineResponse): boolean {
    return line.product.stock > 0 && line.quantity > line.product.stock;
  }

  /**
   * `input` = campul in care s-a scris cantitatea. Daca refuzam valoarea, il readucem la cantitatea
   * reala din cos (altfel ar ramane afisat, de ex., "5" desi in cos sunt 2).
   */
  protected setQuantity(line: CartLineResponse, value: number | string, input?: HTMLInputElement): void {
    const restore = () => {
      if (input) input.value = String(line.quantity);
    };
    const quantity = Math.floor(Number(value));
    if (!Number.isFinite(quantity) || quantity === line.quantity || this.cart.isBusy(line.product.id)) {
      restore();
      return;
    }
    if (quantity < 1) {
      restore();
      this.remove(line);
      return;
    }
    if (quantity > line.product.stock) {
      restore();
      this.toast.warning(`Mai sunt doar ${line.product.stock} bucati din „${line.product.name}”.`);
      return;
    }
    this.cart.updateQuantity(line.product.id, quantity).subscribe({
      error: (err) => {
        restore();
        this.toast.show(getErrorMessage(err), 'danger', 6000);
      },
    });
  }

  /** Readuce cantitatea la stocul disponibil (cand stocul a scazut dupa ce ai pus produsul in cos). */
  protected fitToStock(line: CartLineResponse): void {
    this.setQuantity(line, line.product.stock);
  }

  protected remove(line: CartLineResponse): void {
    this.cart.remove(line.product.id).subscribe({
      next: () => this.toast.info(`„${line.product.name}” a fost scos din cos.`),
      error: (err) => this.toast.show(getErrorMessage(err), 'danger', 6000),
    });
  }
}
