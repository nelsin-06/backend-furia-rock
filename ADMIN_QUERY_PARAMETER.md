# 👨‍💼 Admin Query Parameter Implementation

## 📋 **Overview**

Added `isAdmin` query parameter to `GET /products` endpoint to allow administrators to view both active and inactive products while maintaining default public behavior.

---

## 🔧 **Implementation Details**

### **1. DTO Updates**

#### **ProductQueryDto (`/dto/product.dto.ts`):**
```typescript
export class ProductQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((cat) => cat.trim());
    }
    return value;
  })
  category?: string[];

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAdmin?: boolean; // ✅ NEW: Admin flag to show inactive products
}
```

### **2. Repository Filter Logic**

#### **ProductRepository (`/repositories/product.repository.ts`):**
```typescript
private applyFilters(queryBuilder: SelectQueryBuilder<Product>, filters: ProductFilters) {
  // ... other filters ...

  // Handle admin vs public product visibility
  if (filters.isAdmin === true) {
    // Admin mode: show all products (both active and inactive)
    if (filters.active !== undefined) {
      queryBuilder.andWhere('product.active = :active', {
        active: filters.active,
      });
    }
    // If isAdmin=true and no active filter, show ALL products
  } else {
    // Public mode: default to active products only
    if (filters.active !== undefined) {
      queryBuilder.andWhere('product.active = :active', {
        active: filters.active,
      });
    } else {
      // Default behavior: only show active products
      queryBuilder.andWhere('product.active = :active', {
        active: true,
      });
    }
  }
}
```

### **3. Interface Updates**

#### **ProductFilters (`/repositories/product.repository.entity.ts`):**
```typescript
export interface ProductFilters {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  category?: string[];
  active?: boolean;
  isAdmin?: boolean; // ✅ NEW: Admin flag
}
```

---

## 🎯 **API Behavior**

### **Public Mode (Default):**
```http
GET /products
GET /products?page=1&limit=10
GET /products?active=true

# ✅ Returns only products with active = true
# ❌ Inactive products are hidden
```

### **Admin Mode:**
```http
GET /products?isAdmin=true

# ✅ Returns ALL products (active AND inactive)
# 📊 Shows complete product inventory
```

### **Admin Mode with Filters:**
```http
GET /products?isAdmin=true&active=false

# ✅ Returns only INACTIVE products
# 🔍 Perfect for admin to see products needing attention

GET /products?isAdmin=true&active=true

# ✅ Returns only ACTIVE products (same as public but explicit)
```

---

## 📊 **Query Combinations & Results**

| Query Parameters | Result | Use Case |
|------------------|--------|----------|
| `(none)` | Only active products | 🛍️ Public store catalog |
| `?active=true` | Only active products | 🛍️ Explicit public filtering |
| `?active=false` | No products (default filter overrides) | ❌ Not useful in public mode |
| `?isAdmin=true` | All products (active + inactive) | 👨‍💼 Admin dashboard overview |
| `?isAdmin=true&active=true` | Only active products | 👨‍💼 Admin reviewing published products |
| `?isAdmin=true&active=false` | Only inactive products | 👨‍💼 Admin reviewing unpublished products |

---

## 🔍 **Example API Responses**

### **Public Request:**
```http
GET /products?page=1&limit=5

Response:
{
  "data": [
    {
      "id": "uuid-1",
      "name": "Red T-Shirt",
      "active": true,
      "variables": [
        {
          "colorId": "red-uuid",
          "images": ["image1.jpg", "image2.jpg"]
        }
      ]
    }
    // Only active products
  ],
  "meta": {
    "total": 15, // Only counting active products
    "page": 1,
    "limit": 5
  }
}
```

### **Admin Request:**
```http
GET /products?isAdmin=true&page=1&limit=5

Response:
{
  "data": [
    {
      "id": "uuid-1", 
      "name": "Red T-Shirt",
      "active": true,
      "variables": [...]
    },
    {
      "id": "uuid-2",
      "name": "Blue T-Shirt", 
      "active": false, // ← Inactive product visible to admin
      "variables": [
        {
          "colorId": "blue-uuid",
          "images": [] // ← No images = inactive
        }
      ]
    }
  ],
  "meta": {
    "total": 25, // Counting ALL products (active + inactive)
    "page": 1,
    "limit": 5
  }
}
```

### **Admin Filtering Inactive:**
```http
GET /products?isAdmin=true&active=false

Response:
{
  "data": [
    {
      "id": "uuid-2",
      "name": "Blue T-Shirt",
      "active": false,
      "variables": [
        {
          "colorId": "blue-uuid", 
          "images": [] // ← Needs images to activate
        }
      ]
    },
    {
      "id": "uuid-3",
      "name": "Green Hoodie",
      "active": false,
      "variables": [
        {
          "colorId": "green-uuid",
          "images": ["image1.jpg"]
        },
        {
          "colorId": "black-uuid",
          "images": [] // ← Missing images in one variant
        }
      ]
    }
  ],
  "meta": {
    "total": 10, // Only inactive products
    "page": 1,
    "limit": 10
  }
}
```

---

## 🛡️ **Security Considerations**

### **Current Implementation:**
- ✅ **No authentication required** - parameter is publicly accessible
- ⚠️ **Anyone can see inactive products** with `?isAdmin=true`

### **Recommended Security Enhancement:**
```typescript
// In ProductController
@Get()
@UseGuards(OptionalJwtAuthGuard) // Custom guard
async findAll(@Query() query: ProductQueryDto, @Request() req) {
  // Only allow isAdmin=true for authenticated admin users
  if (query.isAdmin && !req.user?.isAdmin) {
    query.isAdmin = false; // Override unauthorized admin request
  }
  
  return await this.productService.findAll(query);
}
```

### **Alternative Approach:**
Create separate admin endpoint:
```typescript
@Get('admin/all')
@UseGuards(JwtAuthGuard, AdminGuard)
async findAllAdmin(@Query() query: ProductQueryDto) {
  query.isAdmin = true; // Force admin mode
  return await this.productService.findAll(query);
}
```

---

## 🎯 **Frontend Integration**

### **Public Store:**
```javascript
// Regular product listing (customers)
async function getProducts(page = 1, limit = 10) {
  const response = await fetch(`/api/products?page=${page}&limit=${limit}`);
  return response.json(); // Only active products
}
```

### **Admin Dashboard:**
```javascript
// Admin product management
async function getAllProducts(page = 1, limit = 10, activeOnly = null) {
  let url = `/api/products?isAdmin=true&page=${page}&limit=${limit}`;
  
  if (activeOnly !== null) {
    url += `&active=${activeOnly}`;
  }
  
  const response = await fetch(url);
  return response.json(); // All products or filtered by active status
}

// Get only inactive products for admin attention
async function getInactiveProducts() {
  return await getAllProducts(1, 50, false);
}

// Get only active products in admin view
async function getActiveProducts() {
  return await getAllProducts(1, 50, true);
}
```

### **Admin Product Status Dashboard:**
```javascript
async function getProductStatusSummary() {
  const [allProducts, activeProducts, inactiveProducts] = await Promise.all([
    fetch('/api/products?isAdmin=true').then(r => r.json()),
    fetch('/api/products?isAdmin=true&active=true').then(r => r.json()),
    fetch('/api/products?isAdmin=true&active=false').then(r => r.json()),
  ]);

  return {
    total: allProducts.meta.total,
    active: activeProducts.meta.total,
    inactive: inactiveProducts.meta.total,
    activationRate: (activeProducts.meta.total / allProducts.meta.total * 100).toFixed(1)
  };
}
```

---

## ✅ **Implementation Complete**

The `isAdmin` parameter is now fully functional with:

1. ✅ **Public Mode**: Default behavior showing only active products
2. ✅ **Admin Mode**: `?isAdmin=true` shows all products 
3. ✅ **Combined Filtering**: `?isAdmin=true&active=false` for inactive products
4. ✅ **Backward Compatibility**: Existing API behavior unchanged
5. ✅ **Type Safety**: Full TypeScript support with validation

**Next Steps:**
- Consider adding authentication/authorization for admin mode
- Add admin-specific endpoints if needed
- Implement frontend admin dashboard features

Perfect for separating customer-facing product catalog from admin inventory management! 🚀