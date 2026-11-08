import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, QueryParams } from './api.service';
import {
  CategoryRequest,
  CategoryResponse,
  DeliveryMethodRequest,
  DeliveryMethodResponse,
  ProductRequest,
  ProductResponse,
} from './catalog.models';

/**
 * Transforma un produs primit de la server in corpul complet pentru PUT, cu modificarile date.
 * Backend-ul nu are PATCH: orice camp lipsa din PUT s-ar pierde, deci copiem TOT.
 */
export function toProductRequest(product: ProductResponse, changes: Partial<ProductRequest> = {}): ProductRequest {
  return {
    name: product.name,
    description: product.description,
    specifications: product.specifications,
    price: product.price,
    stock: product.stock,
    supplier: product.supplier,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    deliveryMethodIds: product.deliveryMethods.map((d) => d.id),
    ...changes,
  };
}

/**
 * Produse: GET public; POST/PUT/DELETE doar Admin (serverul raspunde 401/403 altfel).
 * Stergerea unui produs il scoate si din cosuri si favorite; comenzile vechi pastreaza o copie.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);

  list(filters?: QueryParams): Observable<ProductResponse[]> {
    return this.api.get<ProductResponse[]>('Product', filters);
  }

  get(id: number): Observable<ProductResponse> {
    return this.api.get<ProductResponse>(`Product/${id}`);
  }

  create(request: ProductRequest): Observable<ProductResponse> {
    return this.api.post<ProductResponse>('Product', request);
  }

  /** Raspunde 204 (fara body). */
  update(id: number, request: ProductRequest): Observable<void> {
    return this.api.put<void>(`Product/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`Product/${id}`);
  }
}

/** Categorii. Stergerea unei categorii care are produse raspunde 409. */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly api = inject(ApiService);

  list(): Observable<CategoryResponse[]> {
    return this.api.get<CategoryResponse[]>('Category');
  }

  create(request: CategoryRequest): Observable<CategoryResponse> {
    return this.api.post<CategoryResponse>('Category', request);
  }

  update(id: number, request: CategoryRequest): Observable<void> {
    return this.api.put<void>(`Category/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`Category/${id}`);
  }
}

/** Metode de livrare. Stergerea unei metode atribuite unor produse raspunde 409. */
@Injectable({ providedIn: 'root' })
export class DeliveryMethodService {
  private readonly api = inject(ApiService);

  list(): Observable<DeliveryMethodResponse[]> {
    return this.api.get<DeliveryMethodResponse[]>('DeliveryMethod');
  }

  create(request: DeliveryMethodRequest): Observable<DeliveryMethodResponse> {
    return this.api.post<DeliveryMethodResponse>('DeliveryMethod', request);
  }

  update(id: number, request: DeliveryMethodRequest): Observable<void> {
    return this.api.put<void>(`DeliveryMethod/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`DeliveryMethod/${id}`);
  }
}
