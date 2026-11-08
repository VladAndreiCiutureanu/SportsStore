import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { getErrorMessage } from '../../core/api-error';
import { ProductResponse } from '../../core/catalog.models';
import { ProductService } from '../../core/catalog.service';
import { AddToCart } from '../../shared/add-to-cart';
import { LeiPipe } from '../../shared/lei.pipe';
import { ProductCard } from '../../shared/product-card';
import { LOW_STOCK, StockBadge } from '../../shared/stock-badge';
import { WishlistButton } from '../../shared/wishlist-button';

/** Pagina unui produs: /products/:id. Ruta e publica. */
@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, FormsModule, LeiPipe, StockBadge, ProductCard, WishlistButton],
  templateUrl: './product-detail.html',
})
export class ProductDetail {
  private readonly productsApi = inject(ProductService);
  private readonly pageTitle = inject(Title);
  protected readonly cart = inject(AddToCart);

  /** Din ruta "products/:id". */
  readonly id = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly product = signal<ProductResponse | null>(null);
  protected readonly similar = signal<ProductResponse[]>([]);
  protected readonly quantity = signal(1);
  protected readonly imageBroken = signal(false);

  protected readonly lowStock = LOW_STOCK;
  protected readonly adding = computed(() => this.cart.addingId() === this.product()?.id);
  /** Cate bucati se pot alege (maxim 10 in selector, dar nu peste stoc). */
  protected readonly quantityOptions = computed(() => {
    const stock = this.product()?.stock ?? 0;
    return Array.from({ length: Math.min(stock, 10) }, (_, i) => i + 1);
  });
  protected readonly cheapestDelivery = computed(() => {
    const methods = this.product()?.deliveryMethods ?? [];
    return methods.length ? Math.min(...methods.map((d) => d.cost)) : null;
  });

  constructor() {
    // Se reincarca si cand treci de la un produs la altul (ex. din "Produse similare").
    effect(() => this.load(Number(this.id())));
  }

  protected load(id: number): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set(null);
    this.quantity.set(1);
    this.imageBroken.set(false);
    this.similar.set([]);

    if (!Number.isInteger(id) || id <= 0) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.productsApi.get(id).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
        this.pageTitle.setTitle(`${p.name} - SportsStore`);
        this.loadSimilar(p);
        window.scrollTo({ top: 0 });
      },
      error: (err) => {
        this.loading.set(false);
        this.product.set(null);
        if (err?.status === 404) this.notFound.set(true);
        else this.error.set(getErrorMessage(err));
      },
    });
  }

  /** Alte produse din aceeasi categorie: intai cele in stoc. */
  private loadSimilar(p: ProductResponse): void {
    this.productsApi
      .list({ categoryId: p.categoryId })
      .pipe(
        map((list) =>
          list
            .filter((x) => x.id !== p.id)
            .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
            .slice(0, 4),
        ),
        catchError(() => of([])),
      )
      .subscribe((list) => this.similar.set(list));
  }

  protected addToCart(): void {
    const p = this.product();
    if (!p) return;
    // Dupa adaugare readucem cantitatea la 1, ca un click nou sa nu adauge din greseala tot atatea.
    this.cart.add(p, this.quantity(), () => this.quantity.set(1));
  }
}
