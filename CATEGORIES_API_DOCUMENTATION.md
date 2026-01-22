# Documentación de API - Endpoints de Categorías (Actualizado)

## 📋 Cambios Principales

- ✅ Las categorías ahora tienen **2 niveles**: **padre** e **hijas**
- ✅ Nueva propiedad `parentId` en todas las categorías
- ✅ Nueva propiedad `children` en las respuestas (solo para categorías padre)
- ✅ El endpoint `GET /categories` ahora retorna solo categorías padre con sus hijas anidadas

---

## 🔌 Endpoints

### 1. **GET /categories**
Obtiene todas las categorías padre con sus hijas anidadas.

**Ruta:** `GET /categories`

**Query Parameters:**
```typescript
{
  page?: number;        // Default: 1
  limit?: number;       // Max: 100
  q?: string;          // Búsqueda por nombre
  sort?: string;       // Ej: "name:ASC", "createdAt:DESC"
  active?: boolean;     // Filtrar por estado activo
  default?: boolean;    // Filtrar por categoría por defecto
}
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid-padre-1",
      "name": "Ropa",
      "default": false,
      "active": true,
      "parentId": null,
      "children": [
        {
          "id": "uuid-hija-1",
          "name": "Camisetas",
          "default": false,
          "active": true,
          "parentId": "uuid-padre-1",
          "children": []
        },
        {
          "id": "uuid-hija-2",
          "name": "Pantalones",
          "default": false,
          "active": true,
          "parentId": "uuid-padre-1",
          "children": []
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

**Cambios:**
- ✅ Ahora retorna solo categorías padre (`parentId: null`)
- ✅ Cada categoría padre incluye su array `children` con las categorías hijas
- ✅ Las categorías hijas tienen `parentId` con el UUID del padre
- ✅ Las categorías hijas tienen `children: []` (vacío, solo 2 niveles permitidos)

---

### 2. **GET /categories/:id**
Obtiene una categoría específica con sus hijas si es padre.

**Ruta:** `GET /categories/:id`

**Path Parameters:**
- `id` (string, UUID): ID de la categoría

**Response 200:**
```json
{
  "id": "uuid-padre-1",
  "name": "Ropa",
  "default": false,
  "active": true,
  "parentId": null,
  "children": [
    {
      "id": "uuid-hija-1",
      "name": "Camisetas",
      "default": false,
      "active": true,
      "parentId": "uuid-padre-1",
      "children": []
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Si la categoría es hija:**
```json
{
  "id": "uuid-hija-1",
  "name": "Camisetas",
  "default": false,
  "active": true,
  "parentId": "uuid-padre-1",
  "children": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Cambios:**
- ✅ Incluye `parentId` (null si es padre, UUID si es hija)
- ✅ Incluye `children` si es padre (vacío si es hija)

---

### 3. **GET /categories/default**
Obtiene la categoría por defecto.

**Ruta:** `GET /categories/default`

**Response 200:**
```json
{
  "id": "uuid-default",
  "name": "General",
  "default": true,
  "active": true,
  "parentId": null,
  "children": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Cambios:**
- ✅ Incluye `parentId` y `children`

---

### 4. **POST /categories**
Crea una nueva categoría (padre o hija).

**Ruta:** `POST /categories`

**Autenticación:** ✅ Requerida (JWT)

**Request Body:**
```json
{
  "name": "Camisetas",
  "parentId": "uuid-padre-1",  // NUEVO: Opcional, UUID del padre. Si es null o no se envía, crea categoría padre
  "default": false,            // Opcional, default: false
  "active": true                // Opcional, default: true
}
```

**Ejemplo - Crear categoría padre:**
```json
{
  "name": "Ropa",
  "active": true
}
```

**Ejemplo - Crear categoría hija:**
```json
{
  "name": "Camisetas",
  "parentId": "uuid-padre-1",
  "active": true
}
```

**Response 201:**
```json
{
  "id": "uuid-nueva",
  "name": "Camisetas",
  "default": false,
  "active": true,
  "parentId": "uuid-padre-1",
  "children": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Validaciones:**
- ✅ `parentId` debe ser un UUID válido si se proporciona
- ✅ El padre debe existir
- ✅ El padre no puede ser una categoría hija (solo 2 niveles)
- ✅ El nombre debe ser único en el mismo nivel (puede repetirse en diferentes niveles)

**Errores posibles:**
- `400`: "Parent category with id 'xxx' not found"
- `400`: "Cannot create a subcategory of a subcategory. Only 2 levels allowed."
- `400`: "Category with name 'xxx' already exists at this level"

---

### 5. **PUT /categories/:id**
Actualiza una categoría existente.

**Ruta:** `PUT /categories/:id`

**Autenticación:** ✅ Requerida (JWT)

**Path Parameters:**
- `id` (string, UUID): ID de la categoría a actualizar

**Request Body:**
```json
{
  "name": "Camisetas Actualizadas",  // Opcional
  "parentId": "uuid-padre-2",       // NUEVO: Opcional, puede cambiar el padre o removerlo (null)
  "default": false,                  // Opcional
  "active": true                     // Opcional
}
```

**Ejemplo - Convertir categoría hija en padre:**
```json
{
  "parentId": null
}
```

**Ejemplo - Cambiar el padre de una categoría hija:**
```json
{
  "parentId": "uuid-otro-padre"
}
```

**Response 200:**
```json
{
  "id": "uuid-categoria",
  "name": "Camisetas Actualizadas",
  "default": false,
  "active": true,
  "parentId": "uuid-padre-2",
  "children": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Validaciones:**
- ✅ No puede ser padre de sí misma
- ✅ No puede convertir un padre en hija si tiene hijas
- ✅ El nuevo padre debe existir y no ser una categoría hija
- ✅ El nombre debe ser único en el mismo nivel

**Errores posibles:**
- `400`: "A category cannot be its own parent"
- `400`: "Cannot convert a parent category into a child category. Remove children first."
- `400`: "Cannot set a subcategory as parent. Only 2 levels allowed."
- `400`: "Category with name 'xxx' already exists at this level"

---

### 6. **DELETE /categories/:id**
Elimina una categoría.

**Ruta:** `DELETE /categories/:id`

**Path Parameters:**
- `id` (string, UUID): ID de la categoría a eliminar

**Response 204:** No Content

**Validaciones:**
- ✅ No se puede eliminar si tiene productos asociados
- ✅ No se puede eliminar si tiene categorías hijas
- ✅ No se puede eliminar la categoría por defecto si es la única activa

**Errores posibles:**
- `400`: "Cannot delete category 'xxx' because it has X subcategory(ies). Please delete or reassign all subcategories first."
- `400`: "Cannot delete category 'xxx' because it is being used by X product(s)."

---

## 📊 Estructura de Datos - CategoryDto

```typescript
interface CategoryDto {
  id: string;
  name: string;
  default: boolean;
  active: boolean;
  parentId: string | null;        // NUEVO: null si es padre, UUID si es hija
  children?: CategoryDto[];        // NUEVO: Array de categorías hijas (solo presente en padres)
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 💡 Notas Importantes para el Frontend

1. **Estructura Jerárquica:**
   - `parentId === null` → Categoría padre
   - `parentId !== null` → Categoría hija
   - Solo 2 niveles permitidos

2. **GET /categories:**
   - Retorna solo categorías padre
   - Cada padre incluye su array `children`
   - Para obtener todas las categorías (padres e hijas), usar `GET /categories/:id` por cada padre

3. **Crear Categorías:**
   - Omitir `parentId` o enviar `null` → Crea categoría padre
   - Enviar `parentId` con UUID → Crea categoría hija

4. **Actualizar Categorías:**
   - `parentId: null` → Convierte hija en padre (solo si no tiene hijas)
   - `parentId: "uuid"` → Cambia el padre o convierte padre en hija (solo si no tiene hijas)

5. **Eliminar Categorías:**
   - Primero eliminar todas las hijas
   - Luego eliminar el padre

6. **Productos:**
   - ⚠️ Los endpoints de productos **NO cambiaron**
   - Los productos retornan solo la categoría asignada (con `parentId`), sin el árbol completo
   - Un producto puede estar asignado a una categoría padre o hija

---

## 📝 Ejemplo de Uso Completo

```typescript
// 1. Crear categoría padre
POST /categories
{
  "name": "Ropa",
  "active": true
}

// 2. Crear categoría hija
POST /categories
{
  "name": "Camisetas",
  "parentId": "uuid-padre-ropa",
  "active": true
}

// 3. Obtener todas las categorías (padres con hijas)
GET /categories
// Retorna: [{ id: "uuid-padre-ropa", name: "Ropa", parentId: null, children: [...] }]

// 4. Obtener categoría específica
GET /categories/uuid-padre-ropa
// Retorna: { id: "uuid-padre-ropa", name: "Ropa", parentId: null, children: [...] }
```

---

## 🔄 Migración desde Versión Anterior

Si el frontend ya tenía implementación previa:

1. **Actualizar tipos TypeScript:**
   ```typescript
   // Antes
   interface Category {
     id: string;
     name: string;
     // ...
   }
   
   // Ahora
   interface Category {
     id: string;
     name: string;
     parentId: string | null;  // NUEVO
     children?: Category[];    // NUEVO
     // ...
   }
   ```

2. **Actualizar componentes de lista:**
   - `GET /categories` ahora retorna estructura anidada
   - Ajustar renderizado para mostrar jerarquía padre-hijo

3. **Actualizar formularios:**
   - Agregar campo `parentId` opcional en formularios de creación/edición
   - Mostrar selector de categorías padre al crear/editar

4. **Validaciones frontend:**
   - Validar que solo se permitan 2 niveles
   - Prevenir ciclos en la jerarquía

---

**Última actualización:** 2024-01-01
**Versión API:** 1.0.0
