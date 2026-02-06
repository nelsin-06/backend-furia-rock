import { Inject, Injectable, BadRequestException, Logger } from '@nestjs/common';
import { UploadApiResponse, v2 as Cloudinary } from 'cloudinary';
import { Multer } from 'multer';
import { ImageValidatorService } from './image-validator.service';

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);

  constructor(
    @Inject('CLOUDINARY') private readonly cloudinary: typeof Cloudinary,
    private readonly imageValidator: ImageValidatorService,
  ) {}

  async upload(file: Express.Multer.File, productId: string): Promise<string> {
    // Validar proporción y dimensiones antes de subir
    const dimensions = await this.imageValidator.validateVerticalImage(file.buffer);

    this.logger.log(
      `Uploading validated image: ${dimensions.width}x${dimensions.height}px ` +
      `(aspect ratio: ${dimensions.aspectRatio.toFixed(3)}) for product ${productId}`
    );

    return new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        {
          folder: `${process.env.CLOUDINARY_FOLDER}/${productId}`,
          resource_type: 'image',
          // Transformaciones opcionales de Cloudinary
          // Guardar en calidad óptima sin modificar dimensiones
          quality: 'auto:good',
          fetch_format: 'auto', // Cloudinary elegirá el mejor formato (WebP, AVIF, etc.)
        },
        (error, result: UploadApiResponse) => {
          if (error) return reject(new BadRequestException(error.message));
          resolve(result.secure_url);
        },
      );
      stream.end(file.buffer);
    });
  }

  async remove(publicId: string): Promise<void> {
    await this.cloudinary.uploader.destroy(publicId, { invalidate: true });
  }

  /**
   * Extract publicId from Cloudinary URL
   * Example: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/image.jpg
   * Returns: folder/image
   */
  extractPublicIdFromUrl(cloudinaryUrl: string): string | null {
    try {
      const url = new URL(cloudinaryUrl);
      const pathParts = url.pathname.split('/');
      
      // Find the index of 'upload' in the path
      const uploadIndex = pathParts.indexOf('upload');
      if (uploadIndex === -1) return null;
      
      // Get everything after 'upload/v{version}/' or 'upload/'
      const afterUpload = pathParts.slice(uploadIndex + 1);
      
      // Remove version if present (v1234567890)
      if (afterUpload[0] && afterUpload[0].startsWith('v') && /^\d+$/.test(afterUpload[0].substring(1))) {
        afterUpload.shift();
      }
      
      // Join remaining parts and remove file extension
      const publicIdWithExtension = afterUpload.join('/');
      const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
      
      return lastDotIndex > 0 
        ? publicIdWithExtension.substring(0, lastDotIndex)
        : publicIdWithExtension;
        
    } catch (error) {
      this.logger.error(
        `Error extracting publicId from URL: ${cloudinaryUrl}`,
        error?.stack,
      );
      return null;
    }
  }

  /**
   * Remove multiple images from Cloudinary
   */
  async removeMultiple(imageUrls: string[]): Promise<void> {
    const removePromises = imageUrls
      .map(url => this.extractPublicIdFromUrl(url))
      .filter(publicId => publicId !== null)
      .map(publicId => this.remove(publicId!));

    await Promise.allSettled(removePromises);
  }
}
