# 🚦 Product Active Flag Implementation

## 📋 **Overview**

Successfully implemented automatic product activation based on image availability. Products now start as **inactive** and automatically become **active** when all variants have at least one image uploaded.

---

## 🏗️ **Implementation Details**

### **1. Entity Updates**

#### **Product Entity (`/entities/product.entity.ts`):**
```typescript
@Column({ type: 'boolean', default: false })
active: boolean; // ✅ Changed from default: true to default: false
```

**Key Changes:**
- ✅ **Default value**: Changed from `true` to `false`
- ✅ **Database constraint**: Products start inactive by default

### **2. DTO Updates**

#### **CreateProductDto (`/dto/product.dto.ts`):**
```typescript
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  price: number;

  @IsNotEmpty()
  @Transform(({ value }) => {
    // Handle comma-separated category IDs
    if (typeof value === 'string') {
      return value.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }
    return value;
  })
  categories?: string;

  // ✅ Active field removed - products start as inactive by default

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariableDto)
  variables?: CreateProductVariableDto[];
}
```

#### **UpdateProductDto (`/dto/product.dto.ts`):**
```typescript
export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    // Handle comma-separated category IDs
    if (typeof value === 'string') {
      return value.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }
    return value;
  })
  categories?: string;

  // ✅ Active field removed - managed automatically based on image availability

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariableDto)
  variables?: CreateProductVariableDto[];
}
```

**Key Changes:**
- ❌ **Removed**: `active` field from UpdateProductDto  
- ✅ **Behavior**: Active status managed automatically, not manually controllable

### **3. Service Logic**

#### **Auto-Activation Method:**
```typescript
/**
 * Check if all variants have at least one image and auto-activate product
 */
private async checkAndUpdateActiveStatus(productId: string): Promise<void> {
  const product = await this.productRepository.findOne({ 
    where: { id: productId } 
  });
  
  if (!product) return;

  let shouldBeActive = false;

  // Product should be active if ALL variants have at least one image
  if (product.variables && product.variables.length > 0) {
    shouldBeActive = product.variables.every(variable => 
      variable.images && variable.images.length > 0
    );
  }

  // Update active status if it changed
  if (product.active !== shouldBeActive) {
    await this.productRepository.update(productId, { active: shouldBeActive });
    console.log(`✅ Product ${productId} active status updated to: ${shouldBeActive}`);
  }
}
```

#### **Product Creation:**
```typescript
async create(createProductDto: CreateProductDto): Promise<ProductDto> {
  // Parse and validate categories
  const categoryIds = this.parseCategoryIds(createProductDto.categories);
  const categories = await this.validateAndGetCategories(categoryIds);
  
  const product = this.productRepository.create({
    name: createProductDto.name,
    price: createProductDto.price,
    active: false, // ✅ Always start as inactive
    variables: createProductDto.variables,
  });
  
  // Set categories relationship
  product.categories = categories;
  
  const savedProduct = await this.productRepository.save(product);
  return await this.mapToDto(savedProduct);
}
```

#### **Product Update:**
```typescript
async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductDto | null> {
  // ... existing product retrieval and validation ...
  
  // Update basic fields (active field removed)
  const updateData = {
    name: updateProductDto.name,
    price: updateProductDto.price,
    // active: updateProductDto.active, // ❌ Removed manual active control
    variables: updateProductDto.variables,
  };

  await this.productRepository.update(id, updateData);
  
  // ... category updates ...

  // ✅ Check and update active status if variables were updated
  if (updateProductDto.variables !== undefined) {
    await this.checkAndUpdateActiveStatus(id);
  }

  // ... return updated product ...
}
```

#### **Image Upload Integration:**
```typescript
// ✅ Auto-activation called after ALL image operations:

// 1. Upload new images
async uploadVariantImages(...): Promise<ProductDto> {
  // ... upload logic ...
  await this.productRepository.update(productId, { variables: updatedVariables });
  
  // Check and update active status based on image availability
  await this.checkAndUpdateActiveStatus(productId);
  
  // ... return updated product ...
}

// 2. Replace images
async replaceVariantImages(...): Promise<ProductDto> {
  // ... replace logic ...
  
  // Check and update active status based on image availability
  await this.checkAndUpdateActiveStatus(productId);
  
  // ... return updated product ...
}

// 3. Delete images
async deleteVariantImage(...): Promise<ProductDto> {
  // ... delete logic ...
  
  // Check and update active status based on image availability
  await this.checkAndUpdateActiveStatus(productId);
  
  // ... return updated product ...
}
```

### **4. Repository Updates**

#### **Active Products Filter:**
```typescript
private applyFilters(queryBuilder: SelectQueryBuilder<Product>, filters: ProductFilters) {
  // ... other filters ...

  // Default to active products only unless explicitly specified
  if (filters.active !== undefined) {
    queryBuilder.andWhere('product.active = :active', {
      active: filters.active,
    });
  } else {
    // ✅ Default behavior: only show active products
    queryBuilder.andWhere('product.active = :active', {
      active: true,
    });
  }
}
```

#### **FindOne Behavior:**
```typescript
async findOne(id: string): Promise<ProductDto | null> {
  const product = await this.productRepository.findOne({ 
    where: { id, active: true } // ✅ Only return active products
  });
  return product ? await this.mapToDto(product) : null;
}
```

---

## 🎯 **Activation Logic Rules**

### **When Products Become Active:**
1. ✅ **All variants have images**: Every variant in `variables` array has at least one image
2. ✅ **At least one variant exists**: Product has at least one variant defined
3. ✅ **Automatic check**: Triggered after every image operation

### **When Products Become Inactive:**
1. ❌ **Missing images**: Any variant has no images (`images: []` or empty)
2. ❌ **Image deletion**: Removing images that make any variant empty
3. ❌ **No variants**: Product has no variants defined

### **Example Scenarios:**

#### **✅ Active Product:**
```json
{
  "variables": [
    {
      "colorId": "red-uuid",
      "images": ["image1.jpg", "image2.jpg"]
    },
    {
      "colorId": "blue-uuid", 
      "images": ["image3.jpg"]
    }
  ]
}
// Result: active = true (all variants have images)
```

#### **❌ Inactive Product:**
```json
{
  "variables": [
    {
      "colorId": "red-uuid",
      "images": ["image1.jpg"]
    },
    {
      "colorId": "blue-uuid",
      "images": [] // ❌ No images
    }
  ]
}
// Result: active = false (one variant has no images)
```

---

## 🔌 **API Behavior Changes**

### **1. GET /products**
```http
GET /products?page=1&limit=10

# ✅ Returns only active products by default
# ✅ Use ?active=false to see inactive products
# ✅ Use ?active=true to explicitly filter active products
```

### **2. GET /products/:id**
```http
GET /products/product-uuid

# ✅ Returns product only if active = true
# ❌ Returns 404 if product is inactive
```

### **3. PUT /products/:id**
```http
PUT /products/product-uuid
Content-Type: application/json

{
  "name": "Updated T-Shirt",
  "price": 35.99,
  "categories": "new-category-uuid",
  "variables": [
    {
      "colorId": "red-uuid",
      "images": ["image1.jpg", "image2.jpg"]
    },
    {
      "colorId": "blue-uuid",
      "images": [] // ← This will make product inactive
    }
  ]
}

# ✅ Product updated and active status automatically calculated
# ✅ If ALL variants have images → active: true
# ✅ If ANY variant has no images → active: false
# ❌ Cannot manually set active field (removed from DTO)
```
```http
POST /products
{
  "name": "T-Shirt",
  "price": 29.99,
  "categories": "category-uuid",
  "variables": [
    {
      "colorId": "red-uuid",
      "images": [] // ← No images
    }
  ]
}

# ✅ Product created with active = false
# ✅ Will become active after uploading images
```

### **4. POST /products**
```http
POST /products
{
  "name": "T-Shirt",
  "price": 29.99,
  "categories": "category-uuid",
  "variables": [
    {
      "colorId": "red-uuid",
      "images": [] // ← No images
    }
  ]
}

# ✅ Product created with active = false
# ✅ Will become active after uploading images
```

### **5. Image Upload Endpoints**
```http
# After any of these operations, product active status is automatically checked:

POST /product-variant-images/:productId/:variantIndex/upload
PUT /product-variant-images/:productId/:variantIndex/replace  
DELETE /product-variant-images/:productId/:variantIndex/:imageIndex
PUT /product-variant-images/:productId/:variantIndex/reorder

# ✅ AND also after product updates with variables:
PUT /products/:productId
```

---

## 🚨 **Important Notes**

### **Database Migration Required:**
```sql
-- Update existing products to follow new default
UPDATE products SET active = false WHERE active = true;

-- Or keep existing products active and only apply to new ones
-- (depends on business requirements)
```

### **Frontend Integration:**
```javascript
// ✅ Creating products
const newProduct = {
  name: "T-Shirt",
  price: 29.99,
  categories: "category-uuid",
  variables: [
    {
      colorId: "red-uuid",
      images: [] // Start empty
    }
  ]
  // ❌ Don't send 'active' field - will be auto-managed
};

// ✅ Check activation status after image uploads
async function uploadImages(productId, variantIndex, files) {
  const formData = new FormData();
  files.forEach(file => formData.append('images', file));
  
  const response = await fetch(`/api/product-variant-images/${productId}/${variantIndex}/upload`, {
    method: 'POST',
    body: formData
  });
  
  const updatedProduct = await response.json();
  console.log('Product is now active:', updatedProduct.active);
}
```

### **Business Rules:**
- ✅ **Customer-facing**: Only active products appear in catalog
- ✅ **Admin interface**: Can see both active and inactive products with `?active=false`
- ✅ **Automatic activation**: No manual intervention needed
- ✅ **Immediate effect**: Status updates instantly after image operations

---

## 🎉 **Implementation Complete**

The active flag system is now fully implemented with:

1. ✅ **Entity defaults**: Products start inactive
2. ✅ **Automatic activation**: Based on image availability
3. ✅ **API filtering**: Only active products in public endpoints
4. ✅ **Real-time updates**: Status changes with image operations
5. ✅ **Business logic**: All variants must have images

Your product catalog now ensures only complete products (with images) are visible to customers! 🚀