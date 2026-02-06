import { 
  Controller, 
  Post, 
  Put,
  Delete,
  Param, 
  Body,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  BadRequestException,
  UseGuards
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('products')
export class ProductVariantImagesController {
  constructor(
    private readonly productService: ProductService,
  ) {}

  /**
   * Upload multiple images for a specific product variant
   * POST /products/:productId/variants/:variantIndex/images
   */
  @Post(':productId/variants/:variantIndex/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(
          new BadRequestException(
            'Solo se permiten imágenes. Formatos aceptados: JPEG, PNG, WebP. ' +
            'Las imágenes deben ser verticales con proporción 7:10 (ejemplo: 700x1000px)'
          ),
          false
        );
      }
      cb(null, true);
    },
  }))
  async uploadVariantImages(
    @Param('productId') productId: string,
    @Param('variantIndex', ParseIntPipe) variantIndex: number,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No images provided');
    }

    return await this.productService.uploadVariantImages(productId, variantIndex, files);
  }

  /**
   * Replace all images for a specific product variant
   * PUT /products/:productId/variants/:variantIndex/images
   */
  @Put(':productId/variants/:variantIndex/images')
  @UseInterceptors(FilesInterceptor('images', 10, {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(
          new BadRequestException(
            'Solo se permiten imágenes. Formatos aceptados: JPEG, PNG, WebP. ' +
            'Las imágenes deben ser verticales con proporción 7:10 (ejemplo: 700x1000px)'
          ),
          false
        );
      }
      cb(null, true);
    },
  }))
  @UseGuards(JwtAuthGuard)
  async replaceVariantImages(
    @Param('productId') productId: string,
    @Param('variantIndex', ParseIntPipe) variantIndex: number,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No images provided');
    }

    return await this.productService.replaceVariantImages(productId, variantIndex, files);
  }

  /**
   * Delete a specific image from a product variant
   * DELETE /products/:productId/variants/:variantIndex/images/:imageIndex
   */
  @Delete(':productId/variants/:variantIndex/images/:imageIndex')
  @UseGuards(JwtAuthGuard)
  async deleteVariantImage(
    @Param('productId') productId: string,
    @Param('variantIndex', ParseIntPipe) variantIndex: number,
    @Param('imageIndex', ParseIntPipe) imageIndex: number
  ) {
    return await this.productService.deleteVariantImage(productId, variantIndex, imageIndex);
  }

  /**
   * Reorder images within a product variant
   * PUT /products/:productId/variants/:variantIndex/images/reorder
   */
  @Put(':productId/variants/:variantIndex/images/reorder')
  @UseGuards(JwtAuthGuard)
  async reorderVariantImages(
    @Param('productId') productId: string,
    @Param('variantIndex', ParseIntPipe) variantIndex: number,
    @Body() reorderData: { imageUrls: string[] }
  ) {
    return await this.productService.reorderVariantImages(
      productId, 
      variantIndex, 
      reorderData.imageUrls
    );
  }
}