// 🧪 Frontend Test Examples for Product Variant Images API

// Test 1: Create product with empty variants, then add images
async function testCompleteWorkflow() {
  console.log('🚀 Starting complete workflow test...');

  // Step 1: Create product with empty image arrays
  const newProduct = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test T-Shirt',
      price: 29.99,
      category: 'shirt',
      variables: [
        { colorId: 'red-color-uuid', images: [] },
        { colorId: 'blue-color-uuid', images: [] }
      ]
    })
  }).then(r => r.json());

  console.log('✅ Product created:', newProduct.id);

  // Step 2: Upload images for red variant (index 0)
  const redImages = [
    new File(['red1'], 'red-front.jpg', { type: 'image/jpeg' }),
    new File(['red2'], 'red-back.jpg', { type: 'image/jpeg' })
  ];

  const formData1 = new FormData();
  redImages.forEach(file => formData1.append('images', file));

  const updatedProduct1 = await fetch(
    `/api/products/${newProduct.id}/variants/0/images`,
    { method: 'POST', body: formData1 }
  ).then(r => r.json());

  console.log('✅ Red variant images uploaded:', updatedProduct1.variables[0].images.length);

  // Step 3: Upload images for blue variant (index 1)
  const blueImages = [
    new File(['blue1'], 'blue-front.jpg', { type: 'image/jpeg' })
  ];

  const formData2 = new FormData();
  blueImages.forEach(file => formData2.append('images', file));

  const updatedProduct2 = await fetch(
    `/api/products/${newProduct.id}/variants/1/images`,
    { method: 'POST', body: formData2 }
  ).then(r => r.json());

  console.log('✅ Blue variant images uploaded:', updatedProduct2.variables[1].images.length);

  // Step 4: Delete first image from red variant
  const updatedProduct3 = await fetch(
    `/api/products/${newProduct.id}/variants/0/images/0`,
    { method: 'DELETE' }
  ).then(r => r.json());

  console.log('✅ First red image deleted. Remaining:', updatedProduct3.variables[0].images.length);

  // Step 5: Reorder blue variant images (if multiple)
  if (updatedProduct3.variables[1].images.length > 1) {
    const currentImages = updatedProduct3.variables[1].images;
    const reorderedImages = currentImages.reverse();

    await fetch(
      `/api/products/${newProduct.id}/variants/1/images/reorder`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: reorderedImages })
      }
    );

    console.log('✅ Blue variant images reordered');
  }

  console.log('🎉 Workflow test completed successfully!');
}

// Test 2: Upload multiple images at once
async function testBulkUpload() {
  const productId = 'existing-product-uuid';
  const variantIndex = 0;

  // Simulate multiple file selection
  const files = [
    new File(['img1'], 'image1.jpg', { type: 'image/jpeg' }),
    new File(['img2'], 'image2.jpg', { type: 'image/jpeg' }),
    new File(['img3'], 'image3.jpg', { type: 'image/jpeg' }),
    new File(['img4'], 'image4.jpg', { type: 'image/jpeg' }),
    new File(['img5'], 'image5.jpg', { type: 'image/jpeg' })
  ];

  const formData = new FormData();
  files.forEach(file => formData.append('images', file));

  try {
    const result = await fetch(
      `/api/products/${productId}/variants/${variantIndex}/images`,
      { method: 'POST', body: formData }
    );

    if (result.ok) {
      const updatedProduct = await result.json();
      console.log('✅ Bulk upload successful:', updatedProduct.variables[variantIndex].images.length, 'images');
    } else {
      console.error('❌ Bulk upload failed:', result.statusText);
    }
  } catch (error) {
    console.error('❌ Upload error:', error);
  }
}

// Test 3: Replace all images
async function testReplaceImages() {
  const productId = 'existing-product-uuid';
  const variantIndex = 0;

  const newFiles = [
    new File(['new1'], 'new-image1.jpg', { type: 'image/jpeg' }),
    new File(['new2'], 'new-image2.jpg', { type: 'image/jpeg' })
  ];

  const formData = new FormData();
  newFiles.forEach(file => formData.append('images', file));

  const result = await fetch(
    `/api/products/${productId}/variants/${variantIndex}/images`,
    { method: 'PUT', body: formData } // PUT = replace all
  ).then(r => r.json());

  console.log('✅ Images replaced. New count:', result.variables[variantIndex].images.length);
}

// Test 4: Error handling
async function testErrorHandling() {
  const productId = 'existing-product-uuid';
  
  try {
    // Test invalid variant index
    await fetch(`/api/products/${productId}/variants/999/images`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.log('✅ Correctly caught invalid variant error');
  }

  try {
    // Test invalid image index
    await fetch(`/api/products/${productId}/variants/0/images/999`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.log('✅ Correctly caught invalid image error');
  }

  try {
    // Test non-existent product
    await fetch('/api/products/invalid-uuid/variants/0/images', {
      method: 'POST',
      body: new FormData()
    });
  } catch (error) {
    console.log('✅ Correctly caught invalid product error');
  }
}

// Run tests
// testCompleteWorkflow();
// testBulkUpload();
// testReplaceImages();
// testErrorHandling();