import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { getErrorMessage } from '../../../core/api-error';
import { DeliveryMethodRequest, DeliveryMethodResponse, ProductResponse } from '../../../core/catalog.models';
import { DeliveryMethodService, ProductService } from '../../../core/catalog.service';
import { ToastService } from '../../../core/toast.service';
import { ConfirmService } from '../../../shared/confirm.service';
import { LeiPipe } from '../../../shared/lei.pipe';

/** Metode de livrare cu tarif fix. Numele e unic; o metoda folosita de produse nu poate fi stearsa. */
@Component({
  selector: 'app-admin-delivery',
  imports: [ReactiveFormsModule, LeiPipe],
  templateUrl: './admin-delivery.html',
})
export class AdminDelivery implements OnInit {
  private readonly api = inject(DeliveryMethodService);
  private readonly productsApi = inject(ProductService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<DeliveryMethodResponse[]>([]);
  private readonly products = signal<ProductResponse[]>([]);
  protected readonly busyId = signal<number | null>(null);

  protected readonly productCount = computed(() => {
    const counts = new Map<number, number>();
    for (const p of this.products()) {
      for (const d of p.deliveryMethods) counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    cost: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  protected readonly editingId = signal<number | null>(null);
  protected readonly editError = signal<string | null>(null);
  protected readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    cost: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ methods: this.api.list(), products: this.productsApi.list() }).subscribe({
      next: ({ methods, products }) => {
        this.items.set(methods);
        this.products.set(products);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(getErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected create(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);

    this.api.create(toRequest(this.createForm.getRawValue())).subscribe({
      next: (created) => {
        this.items.update((list) => [...list, created]);
        this.createForm.reset();
        this.creating.set(false);
        this.toast.success(`Metoda „${created.name}” a fost adaugata.`);
      },
      error: (err) => {
        this.createError.set(getErrorMessage(err));
        this.creating.set(false);
      },
    });
  }

  protected startEdit(method: DeliveryMethodResponse): void {
    this.editingId.set(method.id);
    this.editError.set(null);
    this.editForm.reset({ name: method.name, cost: method.cost });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected saveEdit(method: DeliveryMethodResponse): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid || this.busyId()) return;
    const request = toRequest(this.editForm.getRawValue());
    this.busyId.set(method.id);
    this.editError.set(null);

    this.api.update(method.id, request).subscribe({
      next: () => {
        this.items.update((list) => list.map((m) => (m.id === method.id ? { ...m, ...request } : m)));
        this.editingId.set(null);
        this.busyId.set(null);
        this.toast.success('Metoda de livrare a fost actualizata.');
      },
      error: (err) => {
        this.editError.set(getErrorMessage(err));
        this.busyId.set(null);
      },
    });
  }

  protected async remove(method: DeliveryMethodResponse): Promise<void> {
    const count = this.productCount().get(method.id) ?? 0;
    if (count > 0) {
      this.toast.warning(
        `„${method.name}” este folosita de ${count === 1 ? 'un produs' : `${count} produse`}. Scoate-o mai intai de pe ${count === 1 ? 'el' : 'ele'}.`,
      );
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Stergi metoda de livrare?',
      message: `„${method.name}” va fi stearsa definitiv.`,
      confirmText: 'Sterge metoda',
      danger: true,
    });
    if (!ok) return;

    this.busyId.set(method.id);
    this.api.delete(method.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((m) => m.id !== method.id));
        this.busyId.set(null);
        this.toast.success(`Metoda „${method.name}” a fost stearsa.`);
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.show(getErrorMessage(err), 'danger', 6000);
        this.load();
      },
    });
  }
}

function toRequest(v: { name: string; cost: number | null }): DeliveryMethodRequest {
  return { name: v.name.trim(), cost: Math.round(Number(v.cost) * 100) / 100 };
}
