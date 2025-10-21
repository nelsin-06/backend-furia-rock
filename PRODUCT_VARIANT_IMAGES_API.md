# 🖼️ Product Variant Images API Documentation

## 📋 **API Endpoints Overview**

### **1. Upload Images to Variant**
**`POST /products/:productId/variants/:variantIndex/images`**

Adds new images to an existing product variant (appends to current images).

**Request:**
- **Headers:** `Content-Type: multipart/form-data`
- **Form Fields:**
  - `images`: Array of image files (max 10 files, 5MB each)

**Response:**
```json
{
  "id": "product-uuid",
  "name": "T-Shirt",
  "price": 25.99,
  "category": "shirt",
  "active": true,
  "variables": [
    {
      "colorId": "red-uuid",
      "colorHex": "#ff0000",
      "colorName": "Red",
      "images": [
        "https://cloudinary.../existing-image.jpg",
        "https://cloudinary.../new-image-1.jpg",
        "https://cloudinary.../new-image-2.jpg"
      ]
    }
  ],
  "createdAt": "2025-10-03T10:00:00Z"
}
```

---

### **2. Replace All Variant Images**
**`PUT /products/:productId/variants/:variantIndex/images`**

Replaces ALL existing images with new ones.

**Request:**
- **Headers:** `Content-Type: multipart/form-data`
- **Form Fields:**
  - `images`: Array of image files (max 10 files, 5MB each)

**Response:**
```json
{
  "id": "product-uuid",
  "name": "T-Shirt",
  "variables": [
    {
      "colorId": "red-uuid",
      "colorHex": "#ff0000", 
      "colorName": "Red",
      "images": [
        "https://cloudinary.../replacement-1.jpg",
        "https://cloudinary.../replacement-2.jpg"
      ]
    }
  ]
}
```

---

### **3. Delete Specific Image**
**`DELETE /products/:productId/variants/:variantIndex/images/:imageIndex`**

Deletes a specific image by its index position.

**Request:**
- **URL Parameters:**
  - `productId`: Product UUID
  - `variantIndex`: Variant index (0-based)
  - `imageIndex`: Image index (0-based)

**Response:**
```json
{
  "id": "product-uuid",
  "name": "T-Shirt",
  "variables": [
    {
      "colorId": "red-uuid",
      "colorHex": "#ff0000",
      "colorName": "Red", 
      "images": [
        "https://cloudinary.../remaining-image.jpg"
      ]
    }
  ]
}
```

---

### **4. Reorder Variant Images**
**`PUT /products/:productId/variants/:variantIndex/images/reorder`**

Changes the order of images within a variant.

**Request:**
```json
{
  "imageUrls": [
    "https://cloudinary.../image-3.jpg",
    "https://cloudinary.../image-1.jpg", 
    "https://cloudinary.../image-2.jpg"
  ]
}
```

**Response:**
```json
{
  "id": "product-uuid",
  "variables": [
    {
      "colorId": "red-uuid",
      "images": [
        "https://cloudinary.../image-3.jpg",
        "https://cloudinary.../image-1.jpg",
        "https://cloudinary.../image-2.jpg"
      ]
    }
  ]
}
```

---

## 🌐 **Frontend Integration Examples**

### **1. Upload Multiple Images (Add to Existing)**

```javascript
async function uploadVariantImages(productId, variantIndex, files) {
  const formData = new FormData();
  
  // Add multiple files
  files.forEach(file => {
    formData.append('images', file);
  });

  try {
    const response = await fetch(
      `/api/products/${productId}/variants/${variantIndex}/images`, 
      {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type - browser will set it with boundary
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const updatedProduct = await response.json();
    console.log('✅ Images uploaded:', updatedProduct);
    return updatedProduct;

  } catch (error) {
    console.error('❌ Upload error:', error);
    throw error;
  }
}

// Usage:
const fileInput = document.getElementById('imageInput');
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    await uploadVariantImages('product-uuid', 0, files);
  }
});
```

### **2. Replace All Images**

```javascript
async function replaceVariantImages(productId, variantIndex, files) {
  const formData = new FormData();
  
  files.forEach(file => {
    formData.append('images', file);
  });

  const response = await fetch(
    `/api/products/${productId}/variants/${variantIndex}/images`, 
    {
      method: 'PUT', // PUT instead of POST
      body: formData
    }
  );

  return await response.json();
}

// Usage:
document.getElementById('replaceBtn').addEventListener('click', async () => {
  const files = Array.from(document.getElementById('newImages').files);
  await replaceVariantImages('product-uuid', 0, files);
});
```

### **3. Delete Specific Image**

```javascript
async function deleteVariantImage(productId, variantIndex, imageIndex) {
  try {
    const response = await fetch(
      `/api/products/${productId}/variants/${variantIndex}/images/${imageIndex}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }

    const updatedProduct = await response.json();
    console.log('✅ Image deleted:', updatedProduct);
    return updatedProduct;

  } catch (error) {
    console.error('❌ Delete error:', error);
    throw error;
  }
}

// Usage: Delete button in image gallery
function createImageGallery(variant, productId, variantIndex) {
  return variant.images.map((imageUrl, imageIndex) => `
    <div class="image-item">
      <img src="${imageUrl}" alt="Product variant image" />
      <button onclick="deleteVariantImage('${productId}', ${variantIndex}, ${imageIndex})">
        🗑️ Delete
      </button>
    </div>
  `).join('');
}
```

### **4. Reorder Images (Drag & Drop)**

```javascript
async function reorderVariantImages(productId, variantIndex, newImageOrder) {
  try {
    const response = await fetch(
      `/api/products/${productId}/variants/${variantIndex}/images/reorder`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageUrls: newImageOrder
        })
      }
    );

    return await response.json();

  } catch (error) {
    console.error('❌ Reorder error:', error);
    throw error;
  }
}

// Usage with Sortable.js or similar drag-drop library
import Sortable from 'sortablejs';

function initializeDragDrop(productId, variantIndex) {
  const imageContainer = document.getElementById('image-gallery');
  
  Sortable.create(imageContainer, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async function(evt) {
      // Get new order of image URLs
      const newOrder = Array.from(imageContainer.children)
        .map(item => item.dataset.imageUrl);
      
      // Update backend
      await reorderVariantImages(productId, variantIndex, newOrder);
    }
  });
}
```

### **5. Complete Image Management Component (React Example)**

```jsx
import React, { useState } from 'react';

function VariantImageManager({ productId, variantIndex, initialImages = [] }) {
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files) => {
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch(
        `/api/products/${productId}/variants/${variantIndex}/images`,
        {
          method: 'POST',
          body: formData
        }
      );

      const updatedProduct = await response.json();
      setImages(updatedProduct.variables[variantIndex].images);
      
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageIndex) => {
    try {
      const response = await fetch(
        `/api/products/${productId}/variants/${variantIndex}/images/${imageIndex}`,
        { method: 'DELETE' }
      );

      const updatedProduct = await response.json();
      setImages(updatedProduct.variables[variantIndex].images);
      
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="variant-image-manager">
      <div className="upload-section">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleUpload(e.target.files)}
          disabled={uploading}
        />
        {uploading && <span>Uploading...</span>}
      </div>

      <div className="image-gallery">
        {images.map((imageUrl, index) => (
          <div key={index} className="image-item">
            <img src={imageUrl} alt={`Variant image ${index + 1}`} />
            <button onClick={() => handleDelete(index)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VariantImageManager;
```

---

## 🎯 **Key Implementation Notes**

### **Error Handling:**
- ✅ File size validation (5MB max)
- ✅ File type validation (images only)
- ✅ Maximum file count (10 images)
- ✅ Product/variant existence validation

### **Performance Considerations:**
- ✅ Parallel image uploads to Cloudinary
- ✅ Efficient database updates
- ✅ Proper error rollback

### **Security:**
- ✅ File type validation
- ✅ Size limits
- ✅ Multer configuration with proper limits

### **Best Practices:**
- ✅ RESTful URL structure
- ✅ Proper HTTP verbs
- ✅ Consistent response format
- ✅ FormData for file uploads
- ✅ JSON for data operations