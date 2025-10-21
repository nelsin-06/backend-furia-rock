# 🏆 Quality Entity Implementation

## 📋 **Overview**

Successfully implemented a new **Quality** entity to represent garment quality levels with a **1:1 relationship** to Products. Includes default qualities: **premium**, **intermedia**, and **basica**.

---

## 🗄️ **Database Schema**

### **New Quality Table:**
```sql
CREATE TABLE qualities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) UNIQUE,
  description VARCHAR(200),
  active BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  
  INDEX idx_quality_name (name)
);
```

### **Updated Products Table:**
```sql
ALTER TABLE products 
ADD COLUMN qualityId VARCHAR(36) NOT NULL,
ADD CONSTRAINT fk_product_quality 
  FOREIGN KEY (qualityId) REFERENCES qualities(id),
ADD INDEX idx_product_quality (qualityId);
```

---

## 🏗️ **Entity Definitions**

### **Quality Entity (`/qualities/entities/quality.entity.ts`):**
```typescript
@Entity('qualities')
export class Quality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index('idx_quality_name')
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToMany(() => Product, product => product.quality)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### **Updated Product Entity:**
```typescript
@Entity('products')
export class Product {
  // ... existing fields ...

  @ManyToOne(() => Quality, quality => quality.products)
  @JoinColumn({ name: 'qualityId' })
  quality: Quality;

  @Column({ type: 'uuid' })
  @Index('idx_product_quality')
  qualityId: string;

  // ... rest of fields ...
}
```

---

## 🔧 **Important Fix Applied**

### **Problem Identified:**
When creating products, the `mapToDto` function was failing with error:
```
Cannot read properties of undefined (reading 'id')
TypeError: Cannot read properties of undefined (reading 'id')
at ProductService.mapToDto line 565
```

### **Root Cause:**
The `product` object passed to `mapToDto` only contained `qualityId` but not the full `quality` relationship data.

### **Solution Applied:**
1. **In create method**: Manually assign the fetched `quality` object to `savedProduct`
2. **In all other methods**: Updated `findOne` calls to include `relations: ['categories', 'quality']`

```typescript
// BEFORE (causing error):
const savedProduct = await this.productRepository.save(product);
return await this.mapToDto(savedProduct); // ❌ savedProduct.quality was undefined

// AFTER (fixed):
const savedProduct = await this.productRepository.save(product);
// Assign the quality object to the saved product for mapToDto
savedProduct.quality = {
  id: quality.id,
  name: quality.name,
  description: quality.description,
  active: quality.active,
  createdAt: quality.createdAt,
  updatedAt: quality.updatedAt,
  products: [], // Not needed for mapping
} as any;
return await this.mapToDto(savedProduct); // ✅ Now works correctly
```

### **All Updated Methods:**
- ✅ `create()` - Manual quality assignment
- ✅ `findOne()` - Added quality relation  
- ✅ `update()` - Added quality relation to all findOne calls
- ✅ `uploadVariantImages()` - Added quality relation
- ✅ `replaceVariantImages()` - Added quality relation
- ✅ `deleteVariantImage()` - Added quality relation
- ✅ `reorderVariantImages()` - Added quality relation

---

## 🔧 **API Endpoints**

### **Quality CRUD Operations**

#### **1. Get All Qualities**
```http
GET /qualities

Response:
[
  {
    "id": "quality-uuid-1",
    "name": "premium",
    "description": "Calidad premium con materiales de alta gama",
    "active": true,
    "createdAt": "2025-10-03T10:00:00Z",
    "updatedAt": "2025-10-03T10:00:00Z"
  },
  {
    "id": "quality-uuid-2", 
    "name": "intermedia",
    "description": "Calidad intermedia con buen balance precio-calidad",
    "active": true,
    "createdAt": "2025-10-03T10:00:00Z",
    "updatedAt": "2025-10-03T10:00:00Z"
  },
  {
    "id": "quality-uuid-3",
    "name": "basica", 
    "description": "Calidad básica accesible para todos",
    "active": true,
    "createdAt": "2025-10-03T10:00:00Z",
    "updatedAt": "2025-10-03T10:00:00Z"
  }
]
```

#### **2. Get Quality by ID**
```http
GET /qualities/:id

Response:
{
  "id": "quality-uuid-1",
  "name": "premium",
  "description": "Calidad premium con materiales de alta gama",
  "active": true,
  "createdAt": "2025-10-03T10:00:00Z",
  "updatedAt": "2025-10-03T10:00:00Z"
}
```

#### **3. Create Quality**
```http
POST /qualities
Content-Type: application/json

{
  "name": "deluxe",
  "description": "Calidad deluxe para clientes exclusivos",
  "active": true
}
```

#### **4. Update Quality**
```http
PATCH /qualities/:id
Content-Type: application/json

{
  "name": "premium-plus",
  "description": "Calidad premium mejorada"
}
```

#### **5. Delete Quality**
```http
DELETE /qualities/:id

Response:
{
  "message": "Quality deleted successfully"
}
```

**Business Rules:**
- ❌ Cannot delete quality if used by products
- ✅ Quality names must be unique
- ✅ Names automatically converted to lowercase

---

### **Updated Product Endpoints**

#### **1. Create Product (Now Requires Quality)**
```http
POST /products
Content-Type: application/json

{
  "name": "T-Shirt Premium",
  "price": 45.99,
  "categories": "category-uuid-1,category-uuid-2", 
  "qualityId": "quality-uuid-1", // ← REQUIRED: Quality reference
  "variables": [
    {
      "colorId": "red-uuid",
      "images": []
    }
  ]
}

Response:
{
  "id": "product-uuid",
  "name": "T-Shirt Premium",
  "price": 45.99,
  "categories": [...],
  "quality": {
    "id": "quality-uuid-1",
    "name": "premium", 
    "description": "Calidad premium con materiales de alta gama",
    "active": true,
    "createdAt": "2025-10-03T10:00:00Z",
    "updatedAt": "2025-10-03T10:00:00Z"
  },
  "active": false,
  "variables": [...],
  "createdAt": "2025-10-03T10:00:00Z",
  "updatedAt": "2025-10-03T10:00:00Z"
}
```

#### **2. Update Product Quality**
```http
PATCH /products/:id
Content-Type: application/json

{
  "qualityId": "quality-uuid-2" // Change to intermedia quality
}
```

#### **3. Get Products (Now Includes Quality)**
```http
GET /products?page=1&limit=10

Response:
{
  "data": [
    {
      "id": "product-uuid",
      "name": "T-Shirt Premium",
      "price": 45.99, 
      "categories": [...],
      "quality": {
        "id": "quality-uuid-1",
        "name": "premium",
        "description": "Calidad premium con materiales de alta gama",
        "active": true,
        "createdAt": "2025-10-03T10:00:00Z",
        "updatedAt": "2025-10-03T10:00:00Z"
      },
      "active": true,
      "variables": [...],
      "createdAt": "2025-10-03T10:00:00Z", 
      "updatedAt": "2025-10-03T10:00:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 10
  }
}
```

---

## 🎯 **Default Quality Seeding**

### **Automatic Seeding on App Start:**
```typescript
// App automatically creates these 3 default qualities:

const defaultQualities = [
  { 
    name: 'premium', 
    description: 'Calidad premium con materiales de alta gama' 
  },
  { 
    name: 'intermedia', 
    description: 'Calidad intermedia con buen balance precio-calidad' 
  },
  { 
    name: 'basica', 
    description: 'Calidad básica accesible para todos' 
  },
];
```

### **Console Output:**
```
✅ Created default quality: premium
✅ Created default quality: intermedia  
✅ Created default quality: basica
```

---

## 🔍 **Relationship Details**

### **1:Many Relationship (Quality → Products):**
- ✅ **One Quality** can be used by **many Products**
- ✅ **Every Product** must have **exactly one Quality**  
- ✅ **Foreign Key constraint** ensures data integrity
- ✅ **Cascade loading** automatically includes quality data

### **Database Relationship:**
```sql
-- One quality can have many products
SELECT q.name as quality_name, COUNT(p.id) as product_count 
FROM qualities q 
LEFT JOIN products p ON q.id = p.qualityId 
GROUP BY q.id, q.name;

-- Result example:
-- premium    | 15
-- intermedia | 23  
-- basica     | 8
```

---

## 🚨 **Business Rules & Validation**

### **Quality Rules:**
1. ✅ **Unique Names**: Quality names must be unique (case-insensitive)
2. ✅ **Required Fields**: Name is required, description is optional
3. ✅ **Active Status**: Only active qualities available for new products
4. ✅ **Lowercase Storage**: Names automatically converted to lowercase
5. ❌ **Deletion Protection**: Cannot delete qualities used by products

### **Product Rules:**
1. ✅ **Required Quality**: Every product must have a qualityId
2. ✅ **Valid Quality**: QualityId must reference an existing quality
3. ✅ **Automatic Loading**: Quality data always included in responses
4. ✅ **Update Validation**: New qualityId validated before update

---

## 🎨 **Frontend Integration Examples**

### **Quality Selection Dropdown:**
```javascript
// Get available qualities for product forms
async function getQualities() {
  const response = await fetch('/api/qualities');
  const qualities = await response.json();
  
  return qualities.map(quality => ({
    value: quality.id,
    label: `${quality.name} - ${quality.description}`,
    price_tier: quality.name // for styling/pricing logic
  }));
}

// Example usage in form:
const qualities = await getQualities();
/*
[
  { 
    value: "uuid-1", 
    label: "premium - Calidad premium con materiales de alta gama",
    price_tier: "premium"
  },
  { 
    value: "uuid-2", 
    label: "intermedia - Calidad intermedia con buen balance precio-calidad",
    price_tier: "intermedia" 
  },
  { 
    value: "uuid-3", 
    label: "basica - Calidad básica accesible para todos",
    price_tier: "basica"
  }
]
*/
```

### **Product Creation with Quality:**
```javascript
async function createProduct(productData) {
  const newProduct = {
    name: "Polo Shirt",
    price: 35.99,
    categories: "cat1-uuid,cat2-uuid", 
    qualityId: "premium-quality-uuid", // ← Required field
    variables: [
      {
        colorId: "blue-uuid",
        images: []
      }
    ]
  };

  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProduct)
  });

  const product = await response.json();
  
  // Product response includes full quality object
  console.log(product.quality.name); // "premium"
  console.log(product.quality.description); // "Calidad premium..."
}
```

### **Quality-Based Filtering/Styling:**
```javascript
// Filter products by quality
async function getProductsByQuality(qualityName) {
  const response = await fetch('/api/products');
  const { data: products } = await response.json();
  
  return products.filter(product => 
    product.quality.name === qualityName
  );
}

// Display products with quality badges
function renderProduct(product) {
  const qualityClass = `quality-${product.quality.name}`;
  const qualityLabel = product.quality.name.toUpperCase();
  
  return `
    <div class="product-card ${qualityClass}">
      <h3>${product.name}</h3>
      <span class="quality-badge">${qualityLabel}</span>
      <p class="price">$${product.price}</p>
      <p class="quality-desc">${product.quality.description}</p>
    </div>
  `;
}

// CSS styling by quality
/*
.quality-premium { border: 2px solid gold; }
.quality-intermedia { border: 2px solid silver; }  
.quality-basica { border: 2px solid #ccc; }
*/
```

---

## 🚀 **Migration Process**

### **For New Installations:**
1. ✅ **Automatic Setup**: Run `npm run start:dev`
2. ✅ **Default Qualities Created**: premium, intermedia, basica
3. ✅ **Ready to Use**: Create products with quality references

### **For Existing Products:**
```sql
-- If you have existing products without quality:

-- 1. Add a default quality for existing products
UPDATE products 
SET qualityId = (
  SELECT id FROM qualities WHERE name = 'basica' LIMIT 1
) 
WHERE qualityId IS NULL;

-- 2. Then add the NOT NULL constraint
ALTER TABLE products 
MODIFY COLUMN qualityId VARCHAR(36) NOT NULL;
```

---

## ✅ **Implementation Complete**

The Quality entity system is now fully functional with:

1. ✅ **Quality Entity**: Full CRUD operations with validation
2. ✅ **Product Relationship**: 1:Many relationship properly configured  
3. ✅ **API Integration**: Quality data included in all product responses
4. ✅ **Default Seeding**: 3 default qualities automatically created
5. ✅ **Business Rules**: Unique names, deletion protection, validation
6. ✅ **Type Safety**: Full TypeScript support with DTOs

### **Quality Levels Available:**
- 🥇 **Premium**: High-end materials and construction
- 🥈 **Intermedia**: Balanced quality and price point  
- 🥉 **Basica**: Accessible quality for all customers

Your product catalog now supports **quality-based categorization** for better customer experience and inventory management! 🎉