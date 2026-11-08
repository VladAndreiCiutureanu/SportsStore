import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductResponse } from '../core/catalog.models';
import { AddToCart } from './add-to-cart';
import { LeiPipe } from './lei.pipe';
import { StockBadge } from './stock-badge';
import { WishlistButton } from './wishlist-button';

/** Cardul unui produs in grila catalogului (si la "Produse similare" / "Favorite"). */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, LeiPipe, StockBadge, WishlistButton],
  template: `
    @let p = product();
    <article class="card h-100 border-0 shadow-sm product-card" [class.opacity-75]="p.stock === 0">
      <a [routerLink]="['/products', p.id]" class="ratio ratio-4x3 bg-body-tertiary rounded-top overflow-hidden d-block"
         [attr.aria-label]="p.name" tabindex="-1">
        @if (p.imageUrl && !imageBroken()) {
          <img [src]="p.imageUrl" [alt]="p.name" class="object-fit-contain p-2" loading="lazy" (error)="imageBroken.set(true)" />
        } @else {
          <div class="d-flex align-items-center justify-content-center text-body-tertiary display-6" aria-hidden="true">🏷️</div>
        }
      </a>
      <!-- Inima de favorite, in coltul imaginii -->
      <div class="position-absolute top-0 end-0 m-2" style="z-index: 2">
        <app-wishlist-button [product]="p" />
      </div>
      <div class="card-body d-flex flex-column">
        <div class="small text-body-secondary mb-1">{{ p.categoryName }}</div>
        <h3 class="h6 card-title mb-2">
          <a [routerLink]="['/products', p.id]" class="stretched-link-title text-body text-decoration-none">{{ p.name }}</a>
        </h3>
        <div class="mb-2"><app-stock-badge [stock]="p.stock" /></div>
        <div class="mt-auto">
          <div class="fs-5 fw-bold text-nowrap mb-2">{{ p.price | lei }}</div>
          <button type="button" class="btn btn-sm w-100" [class.btn-primary]="p.stock > 0" [class.btn-secondary]="p.stock === 0"
                  [disabled]="p.stock === 0 || adding()" (click)="cart.add(p)"
                  [attr.aria-label]="p.stock === 0 ? p.name + ' este indisponibil' : 'Adauga ' + p.name + ' in cos'">
            @if (adding()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            } @else if (p.stock === 0) {
              Indisponibil
            } @else {
              Adauga in cos
            }
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  readonly product = input.required<ProductResponse>();
  protected readonly cart = inject(AddToCart);
  protected readonly imageBroken = signal(false);
  protected readonly adding = computed(() => this.cart.addingId() === this.product().id);
}
