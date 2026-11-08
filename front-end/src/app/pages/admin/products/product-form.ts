import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { IMAGE_UPLOAD, ImageUploadService, formatBytes } from '../../../core/image-upload.service';
import { getErrorMessage } from '../../../core/api-error';
import {
  DeliveryMethodResponse,
  ProductRequest,
  ProductResponse,
} from '../../../core/catalog.models';
import { DeliveryMethodService, ProductService } from '../../../core/catalog.service';
import { CategoryStore } from '../../../core/category.store';
import { ToastService } from '../../../core/toast.service';
import { ConfirmService } from '../../../shared/confirm.service';
import { LeiPipe } from '../../../shared/lei.pipe';

/** Limitele din backend (ProductRequest). */
export const PRODUCT_LIMITS = { name: 255, supplier: 255, description: 1023, specifications: 1023 } as const;
const MAX_PRICE = 9_999_999_999_999_999.99;

/** Pretul se pastreaza in baza cu 2 zecimale. */
function twoDecimals(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === '' || v === undefined) return null;
  return Math.round(v * 100) / 100 === Number(v) ? null : { decimals: true };
}

function integer(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === '' || v === undefined) return null;
  return Number.isInteger(Number(v)) ? null : { integer: true };
}

function atLeastOne(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };
}

/**
 * Adrese acceptate pentru imagine:
 * - externe, complete: https://site.ro/poza.jpg
 * - incarcate pe serverul nostru: /images/products/<nume>.jpg (intoarse de upload)
 */
const IMAGE_URL_PATTERN = /^(https?:\/\/\S+|\/images\/\S+)$/i;
const UPLOADED_PREFIX = '/images/';

/**
 * Formular pentru adaugare (/admin/products/new) si editare (/admin/products/:id/edit).
 * La editare trimitem MEREU produsul complet: backend-ul nu are PATCH, iar PUT
 * ar sterge campurile si metodele de livrare care lipsesc din cerere.
 */
@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, LeiPipe],
  templateUrl: './product-form.html',
})
export class ProductForm implements OnInit {
  private readonly productsApi = inject(ProductService);
  private readonly categoryStore = inject(CategoryStore);
  private readonly deliveryApi = inject(DeliveryMethodService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  /** Din ruta ":id/edit" (lipseste la "new"). */
  readonly id = input<string>();
  protected readonly isEdit = computed(() => !!this.id());

  protected readonly limits = PRODUCT_LIMITS;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  /** Din CategoryStore: o categorie adaugata oriunde in aplicatie apare imediat aici. */
  protected readonly categories = this.categoryStore.items;
  protected readonly deliveryMethods = signal<DeliveryMethodResponse[]>([]);
  protected readonly original = signal<ProductResponse | null>(null);
  protected readonly imageBroken = signal(false);

  // --- Imagine: incarcare de pe calculator SAU adresa URL ---
  private readonly uploader = inject(ImageUploadService);
  protected readonly imageMode = signal<'upload' | 'url'>('upload');
  protected readonly uploading = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly uploadFileName = signal('');
  /** Previzualizare locala (din browser) cat timp fisierul urca pe server. */
  protected readonly localPreview = signal<string | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly uploadAccept = IMAGE_UPLOAD.accept;
  protected readonly maxUploadLabel = formatBytes(IMAGE_UPLOAD.maxBytes);
  private uploadSub: Subscription | null = null;
  private saved = false;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(PRODUCT_LIMITS.name)]],
    categoryId: new FormControl<number | null>(null, Validators.required),
    supplier: ['', [Validators.required, Validators.maxLength(PRODUCT_LIMITS.supplier)]],
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01), Validators.max(MAX_PRICE), twoDecimals]),
    stock: new FormControl<number | null>(0, [Validators.required, Validators.min(0), Validators.max(2_147_483_647), integer]),
    deliveryMethodIds: new FormControl<number[]>([], { nonNullable: true, validators: atLeastOne }),
    description: ['', Validators.maxLength(PRODUCT_LIMITS.description)],
    specifications: ['', Validators.maxLength(PRODUCT_LIMITS.specifications)],
    imageUrl: ['', Validators.pattern(IMAGE_URL_PATTERN)],
  });

  // Valori "vii" pentru contoare, previzualizare si sumar.
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly descriptionLength = computed(() => (this.values().description ?? '').length);
  protected readonly specificationsLength = computed(() => (this.values().specifications ?? '').length);
  protected readonly imagePreview = computed(() => {
    const url = (this.values().imageUrl ?? '').trim();
    return IMAGE_URL_PATTERN.test(url) ? url : null;
  });
  protected readonly isUploadedImage = computed(() => (this.values().imageUrl ?? '').startsWith(UPLOADED_PREFIX));

  constructor() {
    // La plecarea de pe pagina oprim o incarcare in curs si eliberam previzualizarea locala.
    inject(DestroyRef).onDestroy(() => {
      this.uploadSub?.unsubscribe();
      this.clearLocalPreview();
    });
  }

  protected readonly selectedDelivery = computed(() => {
    const ids = this.values().deliveryMethodIds ?? [];
    return this.deliveryMethods().filter((d) => ids.includes(d.id));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const id = Number(this.id());

    forkJoin({
      categories: this.categoryStore.load(true),
      delivery: this.deliveryApi.list(),
      product: this.isEdit() ? this.productsApi.get(id) : of(null),
    }).subscribe({
      next: ({ categories, delivery, product }) => {
        this.deliveryMethods.set(delivery);
        if (product) {
          this.original.set(product);
          this.form.reset({
            name: product.name,
            categoryId: product.categoryId,
            supplier: product.supplier,
            price: product.price,
            stock: product.stock,
            deliveryMethodIds: product.deliveryMethods.map((d) => d.id),
            description: product.description ?? '',
            specifications: product.specifications ?? '',
            imageUrl: product.imageUrl ?? '',
          });
          // Produs cu imagine externa: deschidem direct tab-ul "Adresa URL".
          if (product.imageUrl && !product.imageUrl.startsWith(UPLOADED_PREFIX)) this.imageMode.set('url');
        } else if (categories.length === 1) {
          // O singura categorie: o alegem direct.
          this.form.controls.categoryId.setValue(categories[0].id);
        }
        this.form.markAsPristine();
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(err?.status === 404 ? 'Produsul nu exista sau a fost sters.' : getErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  // ------------------------------------------------ categorie noua, direct din formular

  protected readonly quickCategoryOpen = signal(false);
  protected readonly quickCategorySaving = signal(false);
  protected readonly quickCategoryError = signal<string | null>(null);
  protected readonly quickCategoryName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(255)],
  });

  protected openQuickCategory(): void {
    this.quickCategoryName.reset();
    this.quickCategoryError.set(null);
    this.quickCategoryOpen.set(true);
    setTimeout(() => document.getElementById('quickCategoryName')?.focus());
  }

  protected closeQuickCategory(): void {
    this.quickCategoryOpen.set(false);
    setTimeout(() => document.getElementById('categoryId')?.focus());
  }

  /** Creeaza categoria si o selecteaza in produs, fara sa parasesti formularul. */
  protected saveQuickCategory(event?: Event): void {
    event?.preventDefault(); // Enter in acest camp nu trebuie sa trimita formularul produsului
    this.quickCategoryName.markAsTouched();
    const name = this.quickCategoryName.value.trim();
    if (!name || this.quickCategorySaving()) return;
    if (this.categoryStore.nameTaken(name)) {
      // Exista deja: o selectam pe aceea in loc sa cream un duplicat.
      const existing = this.categories().find((c) => c.name.toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro'));
      if (existing) this.selectCategory(existing.id);
      this.toast.info(`Categoria „${existing?.name ?? name}” exista deja si a fost selectata.`);
      this.quickCategoryOpen.set(false);
      return;
    }

    this.quickCategorySaving.set(true);
    this.quickCategoryError.set(null);
    this.categoryStore.create({ name, description: null }).subscribe({
      next: (created) => {
        this.quickCategorySaving.set(false);
        this.quickCategoryOpen.set(false);
        this.selectCategory(created.id);
        this.toast.success(`Categoria „${created.name}” a fost creata si selectata.`);
      },
      error: (err) => {
        this.quickCategorySaving.set(false);
        this.quickCategoryError.set(getErrorMessage(err));
      },
    });
  }

  private selectCategory(id: number): void {
    const control = this.form.controls.categoryId;
    control.setValue(id);
    control.markAsDirty();
    control.markAsTouched();
  }

  // ------------------------------------------------ incarcare imagine

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // ca aceeasi poza sa poata fi aleasa din nou
    if (file) this.startUpload(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault(); // altfel browserul ar deschide imaginea in tab
    if (!this.uploading()) this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && !this.uploading()) this.startUpload(file);
  }

  /**
   * Imaginea urca pe server imediat ce e aleasa; adresa primita se pune in campul imageUrl.
   * Produsul se salveaza abia la "Adauga/Salveaza", ca de obicei.
   */
  private startUpload(file: File): void {
    const problem = this.uploader.validate(file);
    if (problem) {
      this.uploadError.set(problem);
      return;
    }

    this.uploadError.set(null);
    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.uploadFileName.set(file.name);
    this.clearLocalPreview();
    this.localPreview.set(URL.createObjectURL(file));

    this.uploadSub = this.uploader.uploadProductImage(file).subscribe({
      next: (event) => {
        if (event.kind === 'progress') {
          this.uploadProgress.set(event.percent);
          return;
        }
        const control = this.form.controls.imageUrl;
        control.setValue(event.result.url);
        control.markAsDirty();
        this.imageBroken.set(false);
        this.finishUpload();
        this.toast.success('Imaginea a fost incarcata. Nu uita sa salvezi produsul.');
      },
      error: (err) => {
        this.finishUpload();
        this.uploadError.set(getErrorMessage(err));
      },
    });
  }

  protected cancelUpload(): void {
    this.uploadSub?.unsubscribe();
    this.finishUpload();
  }

  protected removeImage(): void {
    const control = this.form.controls.imageUrl;
    control.setValue('');
    control.markAsDirty();
    this.imageBroken.set(false);
    this.uploadError.set(null);
  }

  private finishUpload(): void {
    this.uploading.set(false);
    this.uploadSub = null;
    this.clearLocalPreview();
  }

  private clearLocalPreview(): void {
    const url = this.localPreview();
    if (url) URL.revokeObjectURL(url);
    this.localPreview.set(null);
  }

  protected isDeliverySelected(id: number): boolean {
    return this.form.controls.deliveryMethodIds.value.includes(id);
  }

  protected toggleDelivery(id: number, checked: boolean): void {
    const control = this.form.controls.deliveryMethodIds;
    const current = control.value;
    control.setValue(checked ? [...current, id] : current.filter((x) => x !== id));
    control.markAsDirty();
    control.markAsTouched();
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected has(name: keyof typeof this.form.controls, error: string): boolean {
    return this.form.controls[name].hasError(error);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.uploading()) {
      this.saveError.set('Asteapta sa se termine incarcarea imaginii.');
      return;
    }
    if (this.form.invalid) {
      this.saveError.set('Verifica campurile marcate cu rosu.');
      // Ducem utilizatorul la primul camp gresit.
      setTimeout(() => document.querySelector<HTMLElement>('form .is-invalid')?.focus());
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.saveError.set(null);
    const request = this.toRequest();
    const id = Number(this.id());

    const call: Observable<unknown> = this.isEdit()
      ? this.productsApi.update(id, request)
      : this.productsApi.create(request);
    call.subscribe({
      next: () => {
        this.saved = true;
        this.toast.success(
          this.isEdit() ? `Modificarile la „${request.name}” au fost salvate.` : `Produsul „${request.name}” a fost adaugat.`,
        );
        this.router.navigate(['/admin/products']);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(
          err?.status === 404 ? 'Produsul nu mai exista (poate a fost sters intre timp).' : getErrorMessage(err),
        );
      },
    });
  }

  /** Obiectul complet pentru POST/PUT; textele goale devin null, ca in backend. */
  private toRequest(): ProductRequest {
    const v = this.form.getRawValue();
    const optional = (s: string) => (s.trim() ? s.trim() : null);
    return {
      name: v.name.trim(),
      description: optional(v.description),
      specifications: optional(v.specifications),
      price: Number(v.price),
      stock: Number(v.stock),
      supplier: v.supplier.trim(),
      imageUrl: optional(v.imageUrl),
      categoryId: Number(v.categoryId),
      deliveryMethodIds: [...new Set(v.deliveryMethodIds)],
    };
  }

  /** Folosit de unsavedChangesGuard: intreaba inainte sa pierzi modificarile. */
  canLeave(): boolean | Promise<boolean> {
    if (this.saved || !this.form.dirty) return true;
    return this.confirm.ask({
      title: 'Renunti la modificari?',
      message: 'Ai modificari nesalvate in acest produs.',
      confirmText: 'Pleaca fara sa salvezi',
      cancelText: 'Raman pe pagina',
      danger: true,
    });
  }
}
