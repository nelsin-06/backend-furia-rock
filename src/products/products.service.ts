import { Injectable, BadRequestException, Inject, forwardRef, Logger, NotFoundException } from '@nestjs/common';
import { ProductRepository } from './repositories/product.repository';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductDto,
  CloneProductDto,
} from './dto/product.dto';
import {
  Product,
  ProductVariable,
  CreateProductVariable,
} from './entities/product.entity';
import { ImageUploadService } from './../image-upload/image-upload.service';
import { ProductFilters } from './repositories/product.repository.entity';
import { ColorsService } from '../colors/colors.service';
import { CategoriesService } from '../categories/categories.service';
import { QualitiesService } from '../qualities/qualities.service';
import { CartService } from '../cart/cart.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly imageUploadService: ImageUploadService,
    private readonly colorsService: ColorsService,
    private readonly categoriesService: CategoriesService,
    private readonly qualitiesService: QualitiesService,
    @Inject(forwardRef(() => CartService))
    private readonly cartService: CartService,
  ) {}

  // Generate unique variant ID
  private generateVariantId(): string {
    return uuidv4();
  }

  async findAll(filters: ProductFilters) {
    const result = await this.productRepository.findWithFilters(filters);

    // Resolve color relationships for all products
    const productsWithColors = await Promise.all(
      result.data.map((product) => this.mapToDto(product)),
    );

    return {
      ...result,
      data: productsWithColors,
    };
  }

  async findOne(id: string): Promise<ProductDto | null> {
    const product = await this.productRepository.findOne({
      where: { id }, // Only return active products
      relations: ['categories', 'quality'], // Include quality relation
    });
    return product ? await this.mapToDto(product) : null;
  }

  async create(createProductDto: CreateProductDto): Promise<ProductDto> {
    this.logger.debug(
      '🚀 ~ ProductService ~ create ~ createProductDto:',
      createProductDto,
    );

    // Parse and validate categories
    const categoryIds = this.parseCategoryIds(createProductDto.categories);
    const categories = await this.validateAndGetCategories(categoryIds);

    // Validate quality exists
    const quality = await this.qualitiesService.findOne(
      createProductDto.qualityId,
    );
  this.logger.debug('🚀 ~ ProductService ~ create ~ quality:', quality);
    if (!quality) {
      throw new BadRequestException(
        `Quality with ID ${createProductDto.qualityId} not found`,
      );
    }

    // Generate variantId for each variable
    const variablesWithIds = createProductDto.variables?.map((variable) => ({
      ...variable,
      variantId: this.generateVariantId(),
    }));

    const product = this.productRepository.create({
      name: createProductDto.name,
      description: createProductDto.description || '',
      price: createProductDto.price,
      active: false, // Always start as inactive
      qualityId: createProductDto.qualityId,
      variables: variablesWithIds,
    });

    // Set categories relationship
    product.categories = categories;

    const savedProduct = await this.productRepository.save(product);
  this.logger.debug('🚀 ~ ProductService ~ create ~ savedProduct:', savedProduct);

    // Assign the quality object to the saved product for mapToDto
    // Convert QualityDto to Quality entity structure
    savedProduct.quality = {
      id: quality.id,
      name: quality.name,
      description: quality.description,
      active: quality.active,
      createdAt: quality.createdAt,
      updatedAt: quality.updatedAt,
      products: [], // Not needed for mapping
    } as any;

    return await this.mapToDto(savedProduct);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductDto | null> {
    const existingProduct = await this.productRepository.findOne({
      where: { id },
      relations: ['categories', 'quality'],
    });
    if (!existingProduct) {
      return null;
    }

    // Parse and validate categories if provided
    let categories = existingProduct.categories;
    if (updateProductDto.categories !== undefined) {
      const categoryIds = this.parseCategoryIds(updateProductDto.categories);
      categories = await this.validateAndGetCategories(categoryIds);
    }

    // Validate quality if provided
    if (updateProductDto.qualityId) {
      const quality = await this.qualitiesService.findOne(
        updateProductDto.qualityId,
      );
      if (!quality) {
        throw new BadRequestException(
          `Quality with ID ${updateProductDto.qualityId} not found`,
        );
      }
    }

    // Handle variables update with merge strategy
    let mergedVariables = existingProduct.variables || [];
    
    if (updateProductDto.variables !== undefined) {
      // Validate no duplicate colorIds in the incoming array
      const colorIds = updateProductDto.variables.map(v => v.colorId);
      const duplicateColors = colorIds.filter((color, index) => colorIds.indexOf(color) !== index);
      if (duplicateColors.length > 0) {
        throw new BadRequestException(
          `Duplicate colorIds found in variables: ${duplicateColors.join(', ')}`
        );
      }

      // Validate all colors exist
      const uniqueColorIds = [...new Set(colorIds)];
      const existingColors = await this.colorsService.findByIds(uniqueColorIds);
      if (existingColors.length !== uniqueColorIds.length) {
        const foundColorIds = existingColors.map(c => c.id);
        const missingColors = uniqueColorIds.filter(id => !foundColorIds.includes(id));
        throw new BadRequestException(
          `Colors not found: ${missingColors.join(', ')}`
        );
      }

      // Create map of existing variables by variantId (as CreateProductVariable type)
      const existingMap = new Map<string, CreateProductVariable>(
        (existingProduct.variables || []).map((v) => [v.variantId, {
          variantId: v.variantId,
          colorId: v.colorId,
          images: v.images || []
        }])
      );

      // Build merged array based on incoming variables
      mergedVariables = updateProductDto.variables.map((incoming) => {
        if (incoming.variantId && existingMap.has(incoming.variantId)) {
          // Update existing variant: preserve variantId and images, update colorId
          const existing = existingMap.get(incoming.variantId)!;
          return {
            variantId: existing.variantId!,
            colorId: incoming.colorId,
            images: existing.images || [],
          };
        } else {
          // Create new variant: generate variantId, start with empty images
          return {
            variantId: this.generateVariantId(),
            colorId: incoming.colorId,
            images: [],
          };
        }
      });

      // Note: Variants not present in the incoming array are implicitly deleted
    }

    // Validate active field if provided
    if (updateProductDto.active === true) {
      const variablesToCheck = updateProductDto.variables !== undefined ? mergedVariables : existingProduct.variables;
      
      if (!variablesToCheck || variablesToCheck.length === 0) {
        throw new BadRequestException(
          'Cannot set product as active: product must have at least one variant'
        );
      }

      const allVariablesHaveImages = variablesToCheck.every(
        (v) => v.images && v.images.length > 0
      );

      if (!allVariablesHaveImages) {
        throw new BadRequestException(
          'Cannot set product as active: all variants must have at least one image'
        );
      }
    }

    // Update basic fields
    const updateData: any = {
      name: updateProductDto.name,
      description: updateProductDto.description,
      price: updateProductDto.price,
      qualityId: updateProductDto.qualityId,
      active: updateProductDto.active,
    };

    // Only update variables if explicitly provided
    if (updateProductDto.variables !== undefined) {
      updateData.variables = mergedVariables;
    }

    // Remove undefined values
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key],
    );

    await this.productRepository.update(id, updateData);

    // Update categories relationship if provided
    if (updateProductDto.categories !== undefined) {
      const updatedProduct = await this.productRepository.findOne({
        where: { id },
        relations: ['categories', 'quality'],
      });
      if (updatedProduct) {
        updatedProduct.categories = categories;
        await this.productRepository.save(updatedProduct);
      }
    }

    // Check and update active status if variables were updated
    if (updateProductDto.variables !== undefined) {
      await this.checkAndUpdateActiveStatus(id);
    }

    // Update cart items if price changed
    if (updateProductDto.price !== undefined && updateProductDto.price !== existingProduct.price) {
      await this.cartService.updateCartItemsByProductPrice(id, updateProductDto.price);
    }

    // Remove cart items for deleted variants
    if (updateProductDto.variables !== undefined) {
      const existingVariantIds = new Set(
        (existingProduct.variables || []).map(v => v.variantId)
      );
      const newVariantIds = new Set(
        mergedVariables.map(v => v.variantId)
      );

      // Find deleted variants
      for (const oldVariantId of existingVariantIds) {
        if (!newVariantIds.has(oldVariantId)) {
          await this.cartService.removeCartItemsByVariant(id, oldVariantId);
        }
      }
    }

    const finalProduct = await this.productRepository.findOne({
      where: { id },
      relations: ['categories', 'quality'],
    });
    return finalProduct ? await this.mapToDto(finalProduct) : null;
  }

  async remove(id: string): Promise<boolean> {
    // Get product with images before deleting
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      return false;
    }

    // Collect all image URLs from all variants
    const allImages: string[] = [];
    if (product.variables) {
      product.variables.forEach((variable) => {
        if (variable.images) {
          allImages.push(...variable.images);
        }
      });
    }

    // Delete product from database
    const result = await this.productRepository.delete(id);
    const deleted = result.affected > 0;

    // Remove product from all carts
    if (deleted) {
      try {
        await this.cartService.removeCartItemsByProduct(id);
        this.logger.log(`✅ Removed product ${id} from all carts`);
      } catch (error) {
        this.logger.error('❌ Error removing product from carts', error?.stack);
        // Don't throw error here - the main deletion was successful
      }
    }

    // Remove all images from Cloudinary after successful database deletion
    if (deleted && allImages.length > 0) {
      try {
        await this.imageUploadService.removeMultiple(allImages);
        this.logger.log(
          `✅ Removed ${allImages.length} images from Cloudinary for deleted product: ${id}`,
        );
      } catch (error) {
        this.logger.error(
          '❌ Error removing product images from Cloudinary',
          error?.stack,
        );
        // Don't throw error here - the main deletion was successful
      }
    }

    return deleted;
  }

  /**
   * Clone a product with all its data
   * Optionally change quality during cloning
   * @param id - Product ID to clone
   * @param cloneDto - Optional quality change
   * @returns Cloned product
   */
  async cloneProduct(id: string, cloneDto?: CloneProductDto): Promise<ProductDto> {
    // 1. Buscar producto original con relaciones
    const originalProduct = await this.productRepository.findOne({
      where: { id },
      relations: ['categories', 'quality']
    });
    
    if (!originalProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // 2. Validar que está activo
    if (!originalProduct.active) {
      throw new BadRequestException('Cannot clone inactive product');
    }

    // 3. Determinar calidad (nueva o mantener)
    let targetQuality = originalProduct.quality;
    let targetQualityId = originalProduct.qualityId;
    
    if (cloneDto?.qualityId && cloneDto.qualityId !== originalProduct.qualityId) {
      const newQuality = await this.qualitiesService.findOne(cloneDto.qualityId);
      if (!newQuality) {
        throw new BadRequestException(
          `Quality with ID ${cloneDto.qualityId} not found`
        );
      }
      // Convert QualityDto to Quality entity structure
      targetQuality = {
        id: newQuality.id,
        name: newQuality.name,
        description: newQuality.description,
        active: newQuality.active,
        createdAt: newQuality.createdAt,
        updatedAt: newQuality.updatedAt,
        products: [], // Not needed for mapping
      } as any;
      targetQualityId = cloneDto.qualityId;
    }

    // 4. Clonar variables CON imágenes y nuevos variantIds
    const clonedVariables = originalProduct.variables?.map(variable => ({
      variantId: this.generateVariantId(), // Nuevo UUID
      colorId: variable.colorId,
      images: [...(variable.images || [])] // 🔑 CLONAR TODAS LAS IMÁGENES
    }));

    // 5. Crear producto clonado
    const clonedProduct = this.productRepository.create({
      name: originalProduct.name, // 🔑 MISMO NOMBRE (sin sufijo)
      description: originalProduct.description,
      price: originalProduct.price,
      active: originalProduct.active, // 🔑 Mantener mismo estado activo
      qualityId: targetQualityId,
      variables: clonedVariables || []
    });

    // 6. Copiar categorías (por referencia)
    clonedProduct.categories = originalProduct.categories;

    // 7. Guardar en base de datos
    const savedProduct = await this.productRepository.save(clonedProduct);
    savedProduct.quality = targetQuality;

    this.logger.log(
      `✅ Product cloned: ${originalProduct.id} → ${savedProduct.id}` +
      (cloneDto?.qualityId && cloneDto.qualityId !== originalProduct.qualityId
        ? ` (quality changed to ${targetQualityId})`
        : '')
    );
    
    return await this.mapToDto(savedProduct);
  }

  /**
   * Upload multiple images for a specific product variant
   */
  async uploadVariantImages(
    productId: string,
    variantIndex: number,
    files: Express.Multer.File[],
  ): Promise<ProductDto> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.variables || variantIndex >= product.variables.length) {
      throw new Error('Variant not found');
    }

    // Upload images to Cloudinary
    const uploadResults = await Promise.all(
      files.map((file) => this.imageUploadService.upload(file, productId)),
    );

    // Add new images to existing ones
    const updatedVariables = [...product.variables];
    updatedVariables[variantIndex] = {
      ...updatedVariables[variantIndex],
      images: [
        ...(updatedVariables[variantIndex].images || []),
        ...uploadResults,
      ],
    };

    await this.productRepository.update(productId, {
      variables: updatedVariables,
    });

    // Check and update active status based on image availability
    await this.checkAndUpdateActiveStatus(productId);

    const updatedProduct = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['categories', 'quality'],
    });
    return await this.mapToDto(updatedProduct!);
  }

  /**
   * Replace all images for a specific product variant
   */
  async replaceVariantImages(
    productId: string,
    variantIndex: number,
    files: Express.Multer.File[],
  ): Promise<ProductDto> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.variables || variantIndex >= product.variables.length) {
      throw new Error('Variant not found');
    }

    const variant = product.variables[variantIndex];
    const oldImages = variant.images || [];

    // Upload new images to Cloudinary
    const uploadResults = await Promise.all(
      files.map((file) => this.imageUploadService.upload(file, productId)),
    );

    // Update variant with new images
    const updatedVariables = [...product.variables];
    updatedVariables[variantIndex] = {
      ...updatedVariables[variantIndex],
      images: uploadResults,
    };

    await this.productRepository.update(productId, {
      variables: updatedVariables,
    });

    // Remove old images from Cloudinary after successful database update
    if (oldImages.length > 0) {
      try {
        await this.imageUploadService.removeMultiple(oldImages);
        this.logger.log(
          `✅ Removed ${oldImages.length} old images from Cloudinary`,
        );
      } catch (error) {
        this.logger.error('❌ Error removing old images from Cloudinary', error?.stack);
        // Don't throw error here - the main operation was successful
      }
    }

    // Check and update active status based on image availability
    await this.checkAndUpdateActiveStatus(productId);

    const updatedProduct = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['categories', 'quality'],
    });
    return await this.mapToDto(updatedProduct!);
  }

  /**
   * Delete a specific image from a product variant
   */
  async deleteVariantImage(
    productId: string,
    variantIndex: number,
    imageIndex: number,
  ): Promise<ProductDto> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.variables || variantIndex >= product.variables.length) {
      throw new Error('Variant not found');
    }

    const variant = product.variables[variantIndex];
    if (!variant.images || imageIndex >= variant.images.length) {
      throw new Error('Image not found');
    }

    const imageToDelete = variant.images[imageIndex];

    // Remove image from array
    const updatedVariables = [...product.variables];
    updatedVariables[variantIndex] = {
      ...updatedVariables[variantIndex],
      images: variant.images.filter((_, index) => index !== imageIndex),
    };

    await this.productRepository.update(productId, {
      variables: updatedVariables,
    });

    // Remove image from Cloudinary after successful database update
    try {
      const publicId =
        this.imageUploadService.extractPublicIdFromUrl(imageToDelete);
      if (publicId) {
        await this.imageUploadService.remove(publicId);
        this.logger.log(`✅ Removed image from Cloudinary: ${publicId}`);
      }
    } catch (error) {
      this.logger.error('❌ Error removing image from Cloudinary', error?.stack);
      // Don't throw error here - the main operation was successful
    }

    // Check and update active status based on image availability
    await this.checkAndUpdateActiveStatus(productId);

    const updatedProduct = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['categories', 'quality'],
    });
    return await this.mapToDto(updatedProduct!);
  }

  /**
   * Reorder images within a product variant
   */
  async reorderVariantImages(
    productId: string,
    variantIndex: number,
    newImageOrder: string[],
  ): Promise<ProductDto> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.variables || variantIndex >= product.variables.length) {
      throw new Error('Variant not found');
    }

    // Update image order
    const updatedVariables = [...product.variables];
    updatedVariables[variantIndex] = {
      ...updatedVariables[variantIndex],
      images: newImageOrder,
    };

    await this.productRepository.update(productId, {
      variables: updatedVariables,
    });

    const updatedProduct = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['categories', 'quality'],
    });
    return await this.mapToDto(updatedProduct!);
  }

  /**
   * Clean up orphaned images from Cloudinary (maintenance method)
   * This method can be called periodically to remove unused images
   */
  async cleanupOrphanedImages(): Promise<{ removed: number; errors: number }> {
  this.logger.log('🧹 Starting orphaned images cleanup...');

    try {
      // Get all products with their images
      const products = await this.productRepository.find();
      const usedImages = new Set<string>();

      // Collect all used image URLs
      products.forEach((product) => {
        if (product.variables) {
          product.variables.forEach((variable) => {
            if (variable.images) {
              variable.images.forEach((imageUrl) => usedImages.add(imageUrl));
            }
          });
        }
      });

      this.logger.log(
        `📊 Found ${usedImages.size} images in use across ${products.length} products`,
      );

      // Note: To implement full cleanup, you'd need to:
      // 1. List all images in Cloudinary folder
      // 2. Compare with used images
      // 3. Remove unused ones
      // This requires additional Cloudinary API calls

      return { removed: 0, errors: 0 };
    } catch (error) {
      this.logger.error('❌ Error during cleanup', error?.stack);
      return { removed: 0, errors: 1 };
    }
  }

  /**
   * Parse comma-separated category IDs string into array
   */
  private parseCategoryIds(categoriesInput?: string): string[] {
    if (!categoriesInput) {
      return [];
    }

    // Handle if it's already transformed to array by DTO transformer
    if (Array.isArray(categoriesInput)) {
      return categoriesInput;
    }

    // Handle comma-separated string
    if (typeof categoriesInput === 'string') {
      return categoriesInput
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    }

    return [];
  }

  /**
   * Validate category IDs exist and return Category entities
   */
  private async validateAndGetCategories(
    categoryIds: string[],
  ): Promise<any[]> {
    if (categoryIds.length === 0) {
      // If no categories provided, use default category
      const defaultCategory = await this.categoriesService.getDefaultCategory();
      if (!defaultCategory) {
        throw new BadRequestException(
          'No categories provided and no default category found',
        );
      }
      return [{ id: defaultCategory.id }]; // Return minimal category object for relationship
    }

    // Validate all category IDs exist
    const categories = await this.categoriesService.findByIds(categoryIds);

    if (categories.length !== categoryIds.length) {
      const foundIds = categories.map((c) => c.id);
      const missingIds = categoryIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Invalid category IDs: ${missingIds.join(', ')}`,
      );
    }

    return categories;
  }

  /**
   * Check if all variants have at least one image and auto-activate product
   */
  private async checkAndUpdateActiveStatus(productId: string): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) return;

    let shouldBeActive = false;

    // Product should be active if ALL variants have at least one image
    if (product.variables && product.variables.length > 0) {
      shouldBeActive = product.variables.every(
        (variable) => variable.images && variable.images.length > 0,
      );
    }

    // Update active status if it changed
    if (product.active !== shouldBeActive) {
      await this.productRepository.update(productId, {
        active: shouldBeActive,
      });
      this.logger.log(
        `✅ Product ${productId} active status updated to: ${shouldBeActive}`,
      );
    }
  }

  private async mapToDto(product: Product): Promise<ProductDto> {
    this.logger.debug('🚀 ~ ProductService ~ mapToDto ~ product:', product);
    let resolvedVariables: ProductVariable[] | null = null;

    if (product.variables && product.variables.length > 0) {
      // Get all unique color IDs from variables
      const colorIds = [...new Set(product.variables.map((v) => v.colorId))];

      // Fetch colors in batch
      const colors = await this.colorsService.findByIds(colorIds);
      const colorMap = new Map(colors.map((color) => [color.id, color]));

      // Map variables with resolved color information
      resolvedVariables = product.variables.map((variable) => {
        const color = colorMap.get(variable.colorId);
        return {
          variantId: variable.variantId || this.generateVariantId(),
          colorId: variable.colorId,
          colorHex: color?.hexCode || '',
          colorName: color?.name || '',
          images: variable.images,
        };
      });
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      categories:
        product.categories?.map((category) => ({
          id: category.id,
          name: category.name,
          default: category.default,
          active: category.active,
          parentId: category.parentId || null,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        })) || [],
      quality: {
        id: product.quality.id,
        name: product.quality.name,
        description: product.quality.description,
        active: product.quality.active,
        createdAt: product.quality.createdAt,
        updatedAt: product.quality.updatedAt,
      },
      active: product.active,
      variables: resolvedVariables,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
