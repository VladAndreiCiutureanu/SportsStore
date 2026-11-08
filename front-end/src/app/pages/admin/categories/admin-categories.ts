import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { concatMap, from, last, of, switchMap, tap } from 'rxjs';
import { getErrorMessage } from '../../../core/api-error';
import { CategoryRequest, CategoryResponse, ProductResponse } from '../../../core/catalog.models';
import { ProductService, toProductRequest } from '../../../core/catalog.service';
import { CategoryStore, normalize } from '../../../core/category.store';
import { ToastService } from '../../../core/toast.service';
import { ConfirmService } from '../../../shared/confirm.service';

export const CATEGORY_LIMITS = { name: 255, description: 1023 } as const;

/** Starea ferestrei "Sterge categoria care are produse". */
interface MoveDialog {
  category: CategoryResponse;
  products: ProductResponse[];
  targetId: number | null;
  running: boolean;
  progress: number; // cate produse au fost mutate
  error: string | null;
}

/**
 * Categorii 100% dinamice: Admin-ul le adauga, redenumeste si sterge din interfata.
 * - Numele e unic (fara diferenta intre majuscule), verificat inainte de trimitere si de server.
 * - O categorie cu produse nu poate fi stearsa direct (backend: 409). Oferim mutarea
 *   produselor in alta categorie (un PUT complet pe fiecare produs), apoi stergerea.
 */
@Component({
  selector: 'app-admin-categories',
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './admin-categories.html',
})
export class AdminCategories implements OnInit {
  protected readonly store = inject(CategoryStore);
  private readonly productsApi = inject(ProductService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly limits = CATEGORY_LIMITS;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly products = signal<ProductResponse[]>([]);
  protected readonly busyId = signal<number | null>(null);
  protected readonly search = signal('');

  /** Cate produse are fiecare categorie. */
  protected readonly productCount = computed(() => {
    const counts = new Map<number, number>();
    for (const p of this.products()) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    return counts;
  });

  protected readonly filtered = computed(() => {
    const term = normalize(this.search());
    const list = this.store.items();
    if (!term) return list;
    return list.filter((c) => normalize(c.name).includes(term) || normalize(c.description ?? '').includes(term));
  });

  // --- Adaugare ---
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(CATEGORY_LIMITS.name)]],
    description: ['', Validators.maxLength(CATEGORY_LIMITS.description)],
  });
  private readonly createValues = toSignal(this.createForm.valueChanges, { initialValue: this.createForm.getRawValue() });
  /** Avertizare live: numele exista deja. */
  protected readonly createDuplicate = computed(() => {
    const name = this.createValues().name ?? '';
    return name.trim() !== '' && this.store.nameTaken(name);
  });
  private readonly createNameInput = viewChild<ElementRef<HTMLInputElement>>('createName');

  // --- Editare pe rand ---
  protected readonly editingId = signal<number | null>(null);
  protected readonly editError = signal<string | null>(null);
  protected readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(CATEGORY_LIMITS.name)]],
    description: ['', Validators.maxLength(CATEGORY_LIMITS.description)],
  });
  private readonly editValues = toSignal(this.editForm.valueChanges, { initialValue: this.editForm.getRawValue() });
  protected readonly editDuplicate = computed(() => {
    const name = this.editValues().name ?? '';
    const id = this.editingId();
    return id !== null && name.trim() !== '' && this.store.nameTaken(name, id);
  });

  // --- Stergere cu mutarea produselor ---
  protected readonly moveDialog = signal<MoveDialog | null>(null);
  protected readonly moveTargets = computed(() => {
    const dialog = this.moveDialog();
    return dialog ? this.store.items().filter((c) => c.id !== dialog.category.id) : [];
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.store
      .load(true)
      .pipe(switchMap(() => this.productsApi.list()))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  // ---------------------------------------------------------------- adaugare

  protected create(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.createDuplicate() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);

    this.store.create(toRequest(this.createForm.getRawValue())).subscribe({
      next: (created) => {
        this.createForm.reset();
        this.creating.set(false);
        this.toast.success(`Categoria „${created.name}” a fost adaugata.`);
        this.createNameInput()?.nativeElement.focus(); // gata pentru urmatoarea
      },
      error: (err) => {
        this.createError.set(getErrorMessage(err));
        this.creating.set(false);
      },
    });
  }

  // ---------------------------------------------------------------- editare

  protected startEdit(category: CategoryResponse): void {
    this.editingId.set(category.id);
    this.editError.set(null);
    this.editForm.reset({ name: category.name, description: category.description ?? '' });
    setTimeout(() => document.querySelector<HTMLInputElement>('#editName')?.select());
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected saveEdit(category: CategoryResponse): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid || this.editDuplicate() || this.busyId()) return;
    const request = toRequest(this.editForm.getRawValue());

    // Nimic schimbat: inchidem fara cerere.
    if (request.name === category.name && (request.description ?? null) === (category.description ?? null)) {
      this.editingId.set(null);
      return;
    }

    this.busyId.set(category.id);
    this.editError.set(null);
    this.store.update(category.id, request).subscribe({
      next: () => {
        // Produsele afisate in alte pagini poarta numele categoriei; il actualizam si aici.
        this.products.update((list) =>
          list.map((p) => (p.categoryId === category.id ? { ...p, categoryName: request.name } : p)),
        );
        this.editingId.set(null);
        this.busyId.set(null);
        this.toast.success(
          request.name !== category.name
            ? `Categoria „${category.name}” a fost redenumita in „${request.name}”.`
            : 'Categoria a fost actualizata.',
        );
      },
      error: (err) => {
        this.editError.set(err?.status === 404 ? 'Categoria nu mai exista.' : getErrorMessage(err));
        this.busyId.set(null);
        if (err?.status === 404) this.load();
      },
    });
  }

  // ---------------------------------------------------------------- stergere

  protected async remove(category: CategoryResponse): Promise<void> {
    const inCategory = this.products().filter((p) => p.categoryId === category.id);
    if (inCategory.length > 0) {
      // Nu poate fi stearsa direct: propunem mutarea produselor.
      this.moveDialog.set({
        category,
        products: inCategory,
        targetId: null,
        running: false,
        progress: 0,
        error: null,
      });
      return;
    }

    const ok = await this.confirm.ask({
      title: 'Stergi categoria?',
      message: `Categoria „${category.name}” va fi stearsa definitiv.`,
      details: 'Categoria nu are produse, deci nimic altceva nu este afectat.',
      confirmText: 'Sterge categoria',
      danger: true,
    });
    if (!ok) return;
    this.deleteCategory(category);
  }

  private deleteCategory(category: CategoryResponse, afterMove = false): void {
    this.busyId.set(category.id);
    this.store.delete(category.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.moveDialog.set(null);
        this.toast.success(
          afterMove
            ? `Produsele au fost mutate, iar categoria „${category.name}” a fost stearsa.`
            : `Categoria „${category.name}” a fost stearsa.`,
        );
      },
      error: (err) => {
        this.busyId.set(null);
        const message = getErrorMessage(err);
        const dialog = this.moveDialog();
        if (dialog) this.moveDialog.set({ ...dialog, running: false, error: message });
        else this.toast.show(message, 'danger', 6000);
        this.load(); // ex. 409: intre timp a fost adaugat un produs in categorie
      },
    });
  }

  protected setMoveTarget(id: number | null): void {
    const dialog = this.moveDialog();
    if (dialog) this.moveDialog.set({ ...dialog, targetId: id, error: null });
  }

  protected closeMoveDialog(): void {
    if (!this.moveDialog()?.running) this.moveDialog.set(null);
  }

  /** Muta produsele unul cate unul (PUT complet pe fiecare), apoi sterge categoria. */
  protected moveAndDelete(): void {
    const dialog = this.moveDialog();
    if (!dialog || dialog.running || dialog.targetId === null) return;
    const target = this.store.byId(dialog.targetId);
    if (!target) return;

    this.moveDialog.set({ ...dialog, running: true, progress: 0, error: null });

    from(dialog.products)
      .pipe(
        concatMap((product) =>
          this.productsApi.update(product.id, toProductRequest(product, { categoryId: target.id })).pipe(
            tap(() => {
              this.products.update((list) =>
                list.map((p) => (p.id === product.id ? { ...p, categoryId: target.id, categoryName: target.name } : p)),
              );
              const current = this.moveDialog();
              if (current) this.moveDialog.set({ ...current, progress: current.progress + 1 });
            }),
          ),
        ),
        last(null, null),
        switchMap(() => of(true)),
      )
      .subscribe({
        next: () => this.deleteCategory(dialog.category, true),
        error: (err) => {
          const current = this.moveDialog();
          this.moveDialog.set(
            current
              ? {
                  ...current,
                  running: false,
                  error: `Mutarea s-a oprit dupa ${current.progress} din ${current.products.length} produse: ${getErrorMessage(err)}`,
                }
              : null,
          );
          this.load();
        },
      });
  }
}

function toRequest(v: { name: string; description: string }): CategoryRequest {
  return { name: v.name.trim(), description: v.description.trim() || null };
}
