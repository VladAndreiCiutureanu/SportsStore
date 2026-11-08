import { Component, computed, inject, input } from '@angular/core';
import { ProductResponse } from '../core/catalog.models';
import { WishlistStore } from '../core/wishlist.store';

/**
 * Butonul inima: plina = produsul e la favorite. Folosit pe cardul din catalog (rotund, peste imagine)
 * si pe pagina produsului (buton cu text).
 */
@Component({
  selector: 'app-wishlist-button',
  template: `
    <button type="button" class="btn wishlist-btn" [class.with-label]="withLabel()" [class.active]="saved()"
            [disabled]="busy()" (click)="onClick($event)" [attr.aria-pressed]="saved()"
            [attr.aria-label]="saved() ? 'Scoate ' + product().name + ' de la favorite' : 'Adauga ' + product().name + ' la favorite'"
            [title]="saved() ? 'Scoate de la favorite' : 'Adauga la favorite'">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.1c2-.2 3.9.8 5.4 2.6 1.5-1.8 3.4-2.8 5.4-2.6 3.7.4 5.7 4.3 4.2 7.7C19.5 16.4 12 21 12 21z"
              [attr.fill]="saved() ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      </svg>
      @if (withLabel()) {
        <span>{{ saved() ? 'Salvat la favorite' : 'Adauga la favorite' }}</span>
      }
    </button>
  `,
})
export class WishlistButton {
  readonly product = input.required<ProductResponse>();
  /** true = buton cu text (pagina produsului); false = doar inima (card). */
  readonly withLabel = input(false);

  private readonly wishlist = inject(WishlistStore);
  protected readonly saved = computed(() => this.wishlist.has(this.product().id));
  protected readonly busy = computed(() => this.wishlist.isBusy(this.product().id));

  protected onClick(event: Event): void {
    event.preventDefault(); // pe card, butonul sta peste linkul spre produs
    event.stopPropagation();
    this.wishlist.toggle(this.product());
  }
}
