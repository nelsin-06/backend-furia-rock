import { Injectable, BadRequestException } from '@nestjs/common';
import * as sharp from 'sharp';

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

@Injectable()
export class ImageValidatorService {
  // Proporción objetivo: 7:10 (0.7)
  private readonly TARGET_ASPECT_RATIO = parseFloat(
    process.env.IMAGE_ASPECT_RATIO || '0.7'
  );

  // Tolerancia del 5% (permite 0.665 - 0.735)
  private readonly ASPECT_RATIO_TOLERANCE = parseFloat(
    process.env.IMAGE_ASPECT_RATIO_TOLERANCE || '0.05'
  );

  // Dimensiones mínimas recomendadas para proporción 7:10
  private readonly MIN_WIDTH = parseInt(
    process.env.IMAGE_MIN_WIDTH || '700',
    10
  );
  private readonly MIN_HEIGHT = parseInt(
    process.env.IMAGE_MIN_HEIGHT || '1000',
    10
  );

  // Dimensiones máximas (para evitar imágenes excesivamente grandes)
  private readonly MAX_WIDTH = parseInt(
    process.env.IMAGE_MAX_WIDTH || '4000',
    10
  );
  private readonly MAX_HEIGHT = parseInt(
    process.env.IMAGE_MAX_HEIGHT || '6000',
    10
  );

  /**
   * Valida que una imagen tenga proporción vertical 7:10
   * @param fileBuffer - Buffer de la imagen a validar
   * @returns Dimensiones de la imagen validada
   * @throws BadRequestException si la imagen no cumple los requisitos
   */
  async validateVerticalImage(fileBuffer: Buffer): Promise<ImageDimensions> {
    try {
      const metadata = await sharp(fileBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        throw new BadRequestException(
          'No se pudieron obtener las dimensiones de la imagen'
        );
      }

      const { width, height } = metadata;
      const aspectRatio = width / height;

      // 1. Validar que sea vertical (altura > ancho)
      if (width >= height) {
        throw new BadRequestException(
          `La imagen debe ser vertical (altura mayor que ancho). ` +
          `Dimensiones actuales: ${width}x${height}px`
        );
      }

      // 2. Validar proporción 7:10
      const minRatio = this.TARGET_ASPECT_RATIO * (1 - this.ASPECT_RATIO_TOLERANCE);
      const maxRatio = this.TARGET_ASPECT_RATIO * (1 + this.ASPECT_RATIO_TOLERANCE);

      if (aspectRatio < minRatio || aspectRatio > maxRatio) {
        throw new BadRequestException(
          `La imagen debe tener proporción aproximada de 7:10 (0.7). ` +
          `Proporción actual: ${aspectRatio.toFixed(3)} (${width}x${height}px). ` +
          `Rango aceptado: ${minRatio.toFixed(3)} - ${maxRatio.toFixed(3)}. ` +
          `Ejemplo de dimensiones válidas: 700x1000px, 1400x2000px, 2100x3000px`
        );
      }

      // 3. Validar dimensiones mínimas
      if (width < this.MIN_WIDTH || height < this.MIN_HEIGHT) {
        throw new BadRequestException(
          `Las dimensiones son muy pequeñas para una buena calidad. ` +
          `Mínimo recomendado: ${this.MIN_WIDTH}x${this.MIN_HEIGHT}px. ` +
          `Dimensiones actuales: ${width}x${height}px`
        );
      }

      // 4. Validar dimensiones máximas
      if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
        throw new BadRequestException(
          `Las dimensiones son muy grandes. ` +
          `Máximo permitido: ${this.MAX_WIDTH}x${this.MAX_HEIGHT}px. ` +
          `Dimensiones actuales: ${width}x${height}px. ` +
          `Por favor, reduzca el tamaño de la imagen antes de subirla.`
        );
      }

      return { width, height, aspectRatio };

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al procesar la imagen: ${error.message}`
      );
    }
  }

  /**
   * Obtiene información de la imagen sin validar
   * Útil para análisis o logs
   */
  async getImageInfo(fileBuffer: Buffer): Promise<ImageDimensions> {
    try {
      const metadata = await sharp(fileBuffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        aspectRatio: (metadata.width || 0) / (metadata.height || 1),
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al leer información de la imagen: ${error.message}`
      );
    }
  }

  /**
   * Procesa una imagen para ajustarla a la proporción 7:10
   * Recorta al centro manteniendo la mayor área posible
   */
  async cropToVerticalRatio(fileBuffer: Buffer): Promise<Buffer> {
    try {
      const metadata = await sharp(fileBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        throw new BadRequestException('Imagen inválida');
      }

      const currentRatio = metadata.width / metadata.height;

      // Si ya está en la proporción correcta, retornar sin cambios
      const minRatio = this.TARGET_ASPECT_RATIO * (1 - this.ASPECT_RATIO_TOLERANCE);
      const maxRatio = this.TARGET_ASPECT_RATIO * (1 + this.ASPECT_RATIO_TOLERANCE);

      if (currentRatio >= minRatio && currentRatio <= maxRatio) {
        return fileBuffer;
      }

      // Calcular nuevas dimensiones manteniendo la altura
      const targetHeight = metadata.height;
      const targetWidth = Math.floor(targetHeight * this.TARGET_ASPECT_RATIO);

      // Recortar al centro
      return await sharp(fileBuffer)
        .resize(targetWidth, targetHeight, {
          fit: 'cover',
          position: 'center',
        })
        .toBuffer();

    } catch (error) {
      throw new BadRequestException(
        `Error al procesar la imagen: ${error.message}`
      );
    }
  }
}
