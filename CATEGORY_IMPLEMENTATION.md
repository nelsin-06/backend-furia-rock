# 🏷️ Category Entity Implementation - Complete Refactor

## 📋 **Overview**

Successfully refactored the Product-Category relationship from a simple string field to a proper **many-to-many** relationship using TypeORM entities.

---

## 🗄️ **Database Schema Changes**

### **Before (Old Schema):**
```sql
-- Products table had a simple string field
CREATE TABLE products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(120),
  price DECIMAL(10,2),
  category VARCHAR(60) DEFAULT 'shirt',  -- ❌ Simple string
  active BOOLEAN DEFAULT TRUE,
  variables JSON,
  createdAt TIMESTAMP
);
```

### **After (New Schema):**
```sql
-- 1. New Categories table
CREATE TABLE categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  `default` BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- 2. Updated Products table (removed category field)
CREATE TABLE products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(120),
  price DECIMAL(10,2),
  -- category field REMOVED ✅
  active BOOLEAN DEFAULT TRUE,
  variables JSON,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- 3. New junction table for many-to-many relationship
CREATE TABLE product_categories (
  productId VARCHAR(36),
  categoryId VARCHAR(36),
  PRIMARY KEY (productId, categoryId),
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
);
```

---

## 🏗️ **Entity Definitions**

### **Category Entity**
```typescript
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index('idx_category_name')
  name: string;

  @Column({ type: 'boolean', default: false })
  @Index('idx_category_default')
  default: boolean; // Only ONE category can be default

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ManyToMany(() => Product, product => product.categories)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### **Updated Product Entity**
```typescript
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  @Index('idx_product_name')
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // ✅ NEW: Many-to-many relationship with categories
  @ManyToMany(() => Category, category => category.products)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];

  @Column({ type: 'json', nullable: true })
  variables: CreateProductVariable[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

---

## 🔧 **API Endpoints**

### **Category CRUD Operations**

#### **1. Create Category**
```http
POST /categories
Content-Type: application/json

{
  "name": "Clothing",
  "default": false,
  "active": true
}
```

**Response:**
```json
{
  "id": "category-uuid",
  "name": "Clothing",
  "default": false,
  "active": true,
  "createdAt": "2025-10-03T10:00:00Z",
  "updatedAt": "2025-10-03T10:00:00Z"
}
```

#### **2. Get All Categories**
```http
GET /categories?page=1&limit=10&active=true
```

**Response:**
```json
{
  "data": [
    {
      "id": "default-category-uuid",
      "name": "General",
      "default": true,
      "active": true,
      "createdAt": "2025-10-03T10:00:00Z",
      "updatedAt": "2025-10-03T10:00:00Z"
    },
    {
      "id": "category-uuid",
      "name": "Clothing",
      "default": false,
      "active": true,
      "createdAt": "2025-10-03T10:00:00Z",
      "updatedAt": "2025-10-03T10:00:00Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 10
  }
}
```

#### **3. Update Category**
```http
PUT /categories/:id
Content-Type: application/json

{
  "name": "Updated Clothing",
  "default": true
}
```

#### **4. Delete Category**
```http
DELETE /categories/:id
```

**Business Rules:**
- ❌ Cannot delete if category is used by products
- ❌ Cannot delete default category if it's the only one
- ❌ Cannot delete if it would leave products without categories

#### **5. Get Default Category**
```http
GET /categories/default
```

---

### **Updated Product Endpoints**

#### **1. Create Product with Categories**
```http
POST /products
Content-Type: application/json

{
  "name": "T-Shirt",
  "price": 29.99,
  "categories": "category-uuid-1,category-uuid-2", // Comma-separated IDs
  "active": true,
  "variables": [
    {
      "colorId": "red-uuid",
      "images": []
    }
  ]
}
```

**Response:**
```json
{
  "id": "product-uuid",
  "name": "T-Shirt",
  "price": 29.99,
  "categories": [
    {
      "id": "category-uuid-1",
      "name": "Clothing",
      "default": false,
      "active": true,
      "createdAt": "2025-10-03T10:00:00Z",
      "updatedAt": "2025-10-03T10:00:00Z"
    },
    {
      "id": "category-uuid-2", 
      "name": "Men",
      "default": false,
      "active": true,
      "createdAt": "2025-10-03T10:00:00Z",
      "updatedAt": "2025-10-03T10:00:00Z"
    }
  ],
  "active": true,
  "variables": [...],
  "createdAt": "2025-10-03T10:00:00Z",
  "updatedAt": "2025-10-03T10:00:00Z"
}
```

#### **2. Update Product Categories**
```http
PUT /products/:id
Content-Type: application/json

{
  "name": "Updated T-Shirt",
  "categories": "new-category-uuid-1,new-category-uuid-2"
}
```

#### **3. Get Products with Categories**
```http
GET /products?page=1&limit=10
GET /products/:id
```

Both return the same format with populated `categories` array.

---

## 🔐 **Business Rules & Validation**

### **Category Rules:**
1. ✅ **Unique Names**: Category names must be unique
2. ✅ **Single Default**: Only one category can have `default: true`
3. ✅ **Required Categories**: Products must have at least one category
4. ✅ **Auto-Default**: If no categories provided, uses default category
5. ✅ **Cascade Protection**: Cannot delete categories used by products

### **Product Rules:**
1. ✅ **Category Validation**: All category IDs must exist before linking
2. ✅ **Minimum Categories**: Products must have at least one category
3. ✅ **Comma-Separated Input**: `"cat1,cat2,cat3"` → `[cat1, cat2, cat3]`
4. ✅ **Relationship Loading**: Categories always loaded in queries

---

## 🔄 **Service Layer Implementation**

### **Category Parsing & Validation**
```typescript
// Parse comma-separated string to array
private parseCategoryIds(categoriesInput?: string): string[] {
  if (!categoriesInput) return [];
  
  if (Array.isArray(categoriesInput)) return categoriesInput;
  
  if (typeof categoriesInput === 'string') {
    return categoriesInput.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }
  
  return [];
}

// Validate categories exist and return entities
private async validateAndGetCategories(categoryIds: string[]): Promise<Category[]> {
  if (categoryIds.length === 0) {
    // Use default category if none provided
    const defaultCategory = await this.categoriesService.getDefaultCategory();
    if (!defaultCategory) {
      throw new BadRequestException('No default category found');
    }
    return [{ id: defaultCategory.id }];
  }

  const categories = await this.categoriesService.findByIds(categoryIds);
  
  if (categories.length !== categoryIds.length) {
    const foundIds = categories.map(c => c.id);
    const missingIds = categoryIds.filter(id => !foundIds.includes(id));
    throw new BadRequestException(`Invalid category IDs: ${missingIds.join(', ')}`);
  }

  return categories;
}
```

### **Automatic Relationship Loading**
```typescript
// Repository automatically loads categories
async findWithFilters(filters: ProductFilters) {
  const queryBuilder = this.repository.createQueryBuilder('product')
    .leftJoinAndSelect('product.categories', 'categories'); // ✅ Always loaded
  
  // ... rest of query
}

findOne(options: any): Promise<Product | null> {
  // Always include categories when finding one product
  if (!options.relations) {
    options.relations = ['categories'];
  } else if (!options.relations.includes('categories')) {
    options.relations.push('categories');
  }
  return this.repository.findOne(options);
}
```

---

## 🚀 **Frontend Integration Examples**

### **Creating Products with Categories**
```javascript
async function createProduct(productData) {
  // Frontend sends comma-separated category IDs
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "T-Shirt",
      price: 29.99,
      categories: "cat1-uuid,cat2-uuid", // ✅ Comma-separated
      variables: [...]
    })
  });

  const product = await response.json();
  
  // Backend returns full category objects
  console.log(product.categories); // [{ id, name, default, active, ... }, ...]
}
```

### **Managing Categories**
```javascript
// Create category
async function createCategory(name, isDefault = false) {
  return await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      default: isDefault,
      active: true
    })
  }).then(r => r.json());
}

// Get all categories for dropdown
async function getCategories() {
  return await fetch('/api/categories?active=true')
    .then(r => r.json());
}

// Update product categories
async function updateProductCategories(productId, categoryIds) {
  return await fetch(`/api/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories: categoryIds.join(',') // ✅ Join array to comma-separated
    })
  }).then(r => r.json());
}
```

---

## 🏁 **Migration Summary**

### **✅ Completed:**
1. **Database Schema**: New `categories` table + junction table
2. **Entity Relationships**: Proper TypeORM many-to-many setup
3. **API Endpoints**: Full CRUD for categories
4. **Business Logic**: Validation, default handling, cascade protection
5. **Product Integration**: Updated to use category relationships
6. **Automatic Seeding**: Default "General" category created on startup

### **🔄 Migration Process:**
1. **Backup existing data** before deploying
2. **Create categories** from existing product category strings
3. **Populate junction table** with product-category relationships
4. **Remove old category column** from products table
5. **Deploy new code** with updated entities

### **📊 Benefits:**
- ✅ **Normalized Data**: No more duplicate category strings
- ✅ **Referential Integrity**: Foreign key constraints
- ✅ **Flexible Relationships**: Products can have multiple categories
- ✅ **Efficient Queries**: Join-based filtering and loading
- ✅ **Maintainable**: Centralized category management
- ✅ **Scalable**: Easy to add category metadata (descriptions, images, etc.)

The implementation is **production-ready** with comprehensive validation, error handling, and business rule enforcement! 🎉