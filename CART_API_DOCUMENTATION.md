# Documentación API Carrito - Para Implementación Frontend

## Configuración General

**Base URL:** `http://localhost:3000/api`

**Header Obligatorio en TODOS los endpoints:**
```
x-session-id: {uuid-único-por-visitante}
```

**Notas importantes:**
- El `sessionId` debe generarse en el frontend y persistirse en localStorage
- Todos los totales se calculan server-side, nunca enviar totales desde el frontend
- La expiración del carrito se extiende automáticamente (+15 días) en cada interacción

---

## Endpoints

### 1. GET `/api/cart` - Obtener Carrito

**Request:**
```http
GET /api/cart
Headers:
  x-session-id: abc123-uuid
```

**Response 200:**
```json
{
  "id": "cart-uuid",
  "sessionId": "abc123-uuid",
  "status": "active",
  "subtotal": 2400.00,
  "discountTotal": 240.00,
  "total": 2160.00,
  "expiresAt": "2025-11-06T14:30:00.000Z",
  "items": [
    {
      "id": "item-uuid-1",
      "cartId": "cart-uuid",
      "productId": "product-uuid",
      "variantId": "variant-uuid-red",
      "talla": "M",
      "quantity": 2,
      "price": 500.00,
      "discount": 50.00,
      "total": 900.00
    }
  ],
  "createdAt": "2025-10-22T14:30:00.000Z",
  "updatedAt": "2025-10-22T14:30:00.000Z"
}
```

---

### 2. POST `/api/cart/items` - Agregar Item al Carrito

**Request:**
```http
POST /api/cart/items
Headers:
  x-session-id: abc123-uuid
  Content-Type: application/json
Body:
{
  "productId": "550e8400-e29b-41d4-a716-446655440001",
  "variantId": "variant-uuid-red",
  "talla": "M",
  "quantity": 2
}
```

**Validaciones Body:**
- `productId`: UUID, requerido
- `variantId`: UUID, requerido (debe existir en las variables del producto)
- `talla`: string, requerido (ej: "S", "M", "L", "XL", "XXL")
- `quantity`: number >= 1, requerido

**Response 200:** (mismo formato que GET /cart)

**Errores:**
- `400`: Validación fallida o variantId no existe en el producto
- `404`: Producto no encontrado o inactivo

**Comportamiento:**
- Si ya existe item con mismo productId + variantId + talla → incrementa quantity
- Si alguno de esos campos es diferente → crea nuevo item

---

### 3. PATCH `/api/cart/items/:itemId` - Actualizar Cantidad

**Request:**
```http
PATCH /api/cart/items/item-uuid-123
Headers:
  x-session-id: abc123-uuid
  Content-Type: application/json
Body:
{
  "quantity": 5
}
```

**Validaciones Body:**
- `quantity`: number >= 1, requerido

**Response 200:** (mismo formato que GET /cart)

**Errores:**
- `400`: Validación fallida
- `404`: Item no encontrado o no pertenece al carrito

---

### 4. DELETE `/api/cart/items/:itemId` - Eliminar Item

**Request:**
```http
DELETE /api/cart/items/item-uuid-123
Headers:
  x-session-id: abc123-uuid
```

**Response 200:** (mismo formato que GET /cart)

**Errores:**
- `404`: Item no encontrado

---

### 5. DELETE `/api/cart` - Vaciar Carrito

**Request:**
```http
DELETE /api/cart
Headers:
  x-session-id: abc123-uuid
```

**Response 200:**
```json
{
  "id": "cart-uuid",
  "sessionId": "abc123-uuid",
  "status": "active",
  "subtotal": 0,
  "discountTotal": 0,
  "total": 0,
  "expiresAt": "2025-11-06T14:30:00.000Z",
  "items": [],
  "createdAt": "2025-10-22T14:30:00.000Z",
  "updatedAt": "2025-10-22T14:30:00.000Z"
}
```

---

### 6. POST `/api/cart/complete` - Completar Checkout

**Request:**
```http
POST /api/cart/complete
Headers:
  x-session-id: abc123-uuid
```

**Response 200:** (mismo formato que GET /cart, pero con `status: "completed"`)

**Errores:**
- `400`: Carrito vacío

---

## Tipos TypeScript

```typescript
interface Cart {
  id: string;
  sessionId: string;
  status: 'active' | 'completed' | 'abandoned';
  subtotal: number;
  discountTotal: number;
  total: number;
  expiresAt: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  talla: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}
```

---

## Ejemplo de Flujo Completo

```
1. Usuario entra al sitio
   → Frontend genera sessionId y lo guarda en localStorage

2. Usuario navega a página de carrito
   → GET /api/cart (crea carrito vacío si no existe)

3. Usuario agrega remera roja talla M
   → POST /api/cart/items
   Body: { productId: "...", variantId: "variant-red", talla: "M", quantity: 1 }

4. Usuario agrega misma remera roja pero talla L
   → POST /api/cart/items
   Body: { productId: "...", variantId: "variant-red", talla: "L", quantity: 1 }
   → Se crean 2 items diferentes en el carrito

5. Usuario cambia cantidad de remera M a 3
   → PATCH /api/cart/items/{itemId}
   Body: { quantity: 3 }

6. Usuario elimina remera talla L
   → DELETE /api/cart/items/{itemId}

7. Usuario completa compra
   → POST /api/cart/complete
```

---

## Reglas de Negocio

1. **Unicidad de Items:** Un item es único por la combinación de `productId + variantId + talla`
2. **Totales:** Calculados automáticamente server-side basado en price, discount y quantity
3. **Expiración:** Carrito expira en 15 días desde última interacción
4. **Limpieza:** Carritos expirados se eliminan automáticamente cada día a las 3:00 AM
5. **Validaciones:** El producto debe existir y estar activo, el variantId debe existir en las variables del producto
