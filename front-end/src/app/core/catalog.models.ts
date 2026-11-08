// Formele datelor pentru catalog, exact ca DTO-urile din backend (camelCase in JSON).

export interface CategoryResponse {
  id: number;
  name: string;
  description: string | null;
}

export interface CategoryRequest {
  name: string; // obligatoriu, max 255, unic
  description: string | null; // max 1023
}

export interface DeliveryMethodResponse {
  id: number;
  name: string;
  cost: number; // tarif fix, in lei
}

export interface DeliveryMethodRequest {
  name: string; // obligatoriu, max 255, unic
  cost: number; // >= 0
}

export interface ProductResponse {
  id: number;
  name: string;
  description: string | null;
  specifications: string | null;
  price: number;
  stock: number;
  supplier: string;
  imageUrl: string | null;
  categoryId: number;
  categoryName: string;
  deliveryMethods: DeliveryMethodResponse[];
}

/** O linie din cos: produsul complet (cu stocul curent), cantitatea si totalul liniei. */
export interface CartLineResponse {
  product: ProductResponse;
  quantity: number;
  lineTotal: number;
}

/**
 * GET /api/Cart[?deliveryMethodId=]. Fara metoda aleasa: deliveryMethod, deliveryCost si total sunt null.
 * availableDeliveryMethods = doar metodele comune TUTUROR produselor din cos.
 */
export interface CartSummaryResponse {
  items: CartLineResponse[];
  subtotal: number;
  availableDeliveryMethods: DeliveryMethodResponse[];
  deliveryMethod: DeliveryMethodResponse | null;
  deliveryCost: number | null;
  total: number | null;
}

/**
 * Corpul pentru POST si PUT /api/Product.
 * ATENTIE: PUT inlocuieste TOT produsul. Campurile lipsa devin null, iar o lista
 * deliveryMethodIds lipsa sterge toate metodele de livrare. Trimitem mereu obiectul complet.
 */
export interface ProductRequest {
  name: string; // obligatoriu, max 255
  description: string | null; // max 1023
  specifications: string | null; // max 1023
  price: number; // >= 0.01
  stock: number; // >= 0, intreg
  supplier: string; // obligatoriu, max 255
  imageUrl: string | null;
  categoryId: number;
  deliveryMethodIds: number[]; // fara duplicate, toate trebuie sa existe
}
