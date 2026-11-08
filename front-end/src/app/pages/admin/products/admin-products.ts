import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { getErrorMessage } from '../../../core/api-error';
import { DeliveryMethodResponse, ProductResponse } from '../../../core/catalog.models';
import { DeliveryMethodService, ProductService } from '../../../core/catalog.service';
import { CategoryStore } from '../../../core/category.store';
import { ToastService } from '../../../core/toast.service';
import { ConfirmService } from '../../../shared/confirm.service';
import { LeiPipe } from '../../../shared/lei.pipe';

type StockFilter = 'all' | 'in' | 'low' | 'out';

/** Lista produselor pentru Admin: cautare, filtre, editare si stergere. */
@Component({
  selector: 'app-admin-products',
  imports: [RouterLink, FormsModule, LeiPipe],
  templateUrl: './admin-products.html',
})
export class AdminProducts implements OnInit {
  private readonly products = inject(ProductService);
  private readonly categoryStore = inject(CategoryStore);
  private readonly deliveryApi = inject(DeliveryMethodService);

  /** ?categoryId=5 din URL (ex. click pe numarul de produse din pagina Categorii). */
  readonly categoryParam = input<string | undefined>(undefined, { alias: 'categoryId' });
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<ProductResponse[]>([]);
  protected readonly categories = this.categoryStore.items;
  protected readonly deliveryMethods = signal<DeliveryMethodResponse[]>([]);
  protected readonly deletingId = signal<number | null>(null);

  // Filtre (locale: lista vine intreaga de la server, nepaginata)
  protected readonly search = signal('');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly stock = signal<StockFilter>('all');

  /** Sub acest stoc produsul apare marcat "stoc redus". */
  protected readonly lowStock = 5;

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const cat = this.categoryId();
    const stock = this.stock();
    return this.items().filter((p) => {
      if (cat !== null && p.categoryId !== cat) return false;
      if (stock === 'in' && p.stock === 0) return false;
      if (stock === 'out' && p.stock !== 0) return false;
      if (stock === 'low' && (p.stock === 0 || p.stock > this.lowStock)) return false;
      if (!term) return true;
      return [p.name, p.supplier, p.description ?? '', p.specifications ?? '', p.categoryName].some((f) =>
        f.toLowerCase().includes(term),
      );
    });
  });

  protected readonly stats = computed(() => {
    const all = this.items();
    return {
      total: all.length,
      outOfStock: all.filter((p) => p.stock === 0).length,
      lowStock: all.filter((p) => p.stock > 0 && p.stock <= this.lowStock).length,
    };
  });

  /** Fara categorii sau metode de livrare nu se poate crea niciun produs. */
  protected readonly missingSetup = computed(() => !this.loading() && (this.categories().length === 0 || this.deliveryMethods().length === 0));
  protected readonly hasFilters = computed(() => !!this.search().trim() || this.categoryId() !== null || this.stock() !== 'all');

  ngOnInit(): void {
    const fromUrl = Number(this.categoryParam());
    if (Number.isInteger(fromUrl) && fromUrl > 0) this.categoryId.set(fromUrl);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      products: this.products.list(),
      categories: this.categoryStore.load(true),
      delivery: this.deliveryApi.list(),
    }).subscribe({
      next: ({ products, delivery }) => {
        this.items.set(products);
        this.deliveryMethods.set(delivery);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(getErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected clearFilters(): void {
    this.search.set('');
    this.categoryId.set(null);
    this.stock.set('all');
  }

  protected async remove(product: ProductResponse): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Stergi produsul?',
      message: `„${product.name}” va fi sters definitiv din catalog.`,
      details:
        'Va disparea si din cosurile si listele de favorite ale clientilor. Comenzile deja plasate raman neschimbate.',
      confirmText: 'Sterge produsul',
      danger: true,
    });
    if (!ok) return;

    this.deletingId.set(product.id);
    this.products.delete(product.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((p) => p.id !== product.id));
        this.deletingId.set(null);
        this.toast.success(`Produsul „${product.name}” a fost sters.`);
      },
      error: (err) => {
        this.deletingId.set(null);
        this.toast.show(getErrorMessage(err), 'danger', 6000);
        if (err?.status === 404) this.load(); // sters deja de altcineva
      },
    });
  }
}
