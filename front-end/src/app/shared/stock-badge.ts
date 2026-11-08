import { Component, input } from '@angular/core';

/** Sub acest numar de bucati afisam "Ultimele X bucati". */
export const LOW_STOCK = 5;

/** Disponibilitatea unui produs, la fel peste tot in magazin. */
@Component({
  selector: 'app-stock-badge',
  template: `
    @if (stock() === 0) {
      <span class="badge text-bg-secondary">Indisponibil</span>
    } @else if (stock() <= low) {
      <span class="badge text-bg-warning">Ultimele {{ stock() }} {{ stock() === 1 ? 'bucata' : 'bucati' }}</span>
    } @else {
      <span class="badge text-bg-success-subtle text-success-emphasis border border-success-subtle">In stoc</span>
    }
  `,
})
export class StockBadge {
  readonly stock = input.required<number>();
  protected readonly low = LOW_STOCK;
}
