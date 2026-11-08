import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WishlistStore } from '../../core/wishlist.store';
import { ProductCard } from '../../shared/product-card';

/**
 * Pagina "Favorite" (/wishlist). Necesita login (authGuard).
 * Lista vine din WishlistStore, deci e aceeasi cu inimile din catalog: daca scoti un produs
 * de aici, inima lui se goleste si in catalog, si invers.
 */
@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, ProductCard],
  template: `
    <div class="d-flex flex-wrap align-items-baseline gap-2 mb-3">
      <h1 class="h3 mb-0 me-auto">Produse favorite</h1>
      @if (wishlist.loaded() && wishlist.count()) {
        <span class="small text-body-secondary">
          {{ wishlist.count() }} {{ wishlist.count() === 1 ? 'produs' : 'produse' }}
          @if (unavailable()) { · {{ unavailable() }} indisponibil{{ unavailable() === 1 ? '' : 'e' }} momentan }
        </span>
      }
    </div>

    @if (wishlist.error(); as message) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center">
        <span>{{ message }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="wishlist.load()">Reincearca</button>
      </div>
    } @else if (!wishlist.loaded()) {
      <div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3 placeholder-glow" aria-busy="true" aria-label="Se incarca favoritele">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="col">
            <div class="card border-0 shadow-sm h-100">
              <div class="ratio ratio-4x3 placeholder rounded-top"></div>
              <div class="card-body"><span class="placeholder col-8 mb-2"></span><span class="placeholder col-5"></span></div>
            </div>
          </div>
        }
      </div>
    } @else if (wishlist.count() === 0) {
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-5">
          <div class="display-5 mb-2" aria-hidden="true">🤍</div>
          <h2 class="h5">Nu ai inca produse favorite</h2>
          <p class="text-body-secondary">Apasa pe inima de pe orice produs ca sa-l salvezi aici si sa-l gasesti usor mai tarziu.</p>
          <a routerLink="/" class="btn btn-primary">Descopera produsele</a>
        </div>
      </div>
    } @else {
      <p class="small text-body-secondary">Apasa pe inima ca sa scoti un produs din lista.</p>
      <div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3">
        @for (p of wishlist.items(); track p.id) {
          <div class="col"><app-product-card [product]="p" /></div>
        }
      </div>
    }
  `,
})
export class Wishlist {
  protected readonly wishlist = inject(WishlistStore);
  protected readonly unavailable = computed(() => this.wishlist.items().filter((p) => p.stock === 0).length);

  constructor() {
    // Reincarcam la intrarea pe pagina: stocul sau pretul s-ar fi putut schimba intre timp.
    if (this.wishlist.loaded()) this.wishlist.load();
  }
}
