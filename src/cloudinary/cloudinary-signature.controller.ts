import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinarySignatureService } from './cloudinary-signature.service';
import { GenerateSignatureDto } from './dto/cloudinary-signature.dto';

/**
 * Admin-only endpoint for generating Cloudinary signed-upload parameters.
 *
 * Flow:
 *   1. Admin frontend calls POST /api/admin/uploads/signature with { preset, folder? }
 *   2. Backend validates preset allowlist + folder prefix, generates signature
 *   3. Frontend uses the returned params to upload directly to Cloudinary
 *   4. Frontend persists the resulting Cloudinary URL(s) via the existing product API
 *
 * This keeps CLOUDINARY_API_SECRET server-side and prevents unsigned uploads.
 */
@Controller('admin/uploads')
@UseGuards(JwtAuthGuard)
export class CloudinarySignatureController {
  private readonly logger = new Logger(CloudinarySignatureController.name);

  constructor(
    private readonly signatureService: CloudinarySignatureService,
  ) {}

  /**
   * POST /api/admin/uploads/signature
   *
   * Request body:
   *   { preset: "products", folder?: "furia-rock/products/abc-123" }
   *
   * Response:
   *   { signature, timestamp, upload_preset, folder?, api_key, cloud_name }
   */
  @Post('signature')
  @HttpCode(200)
  generateSignature(@Body() dto: GenerateSignatureDto) {
    this.logger.log(
      `Signature requested — preset: ${dto.preset}, folder: ${dto.folder ?? '(none)'}`,
    );

    return this.signatureService.generateSignature(dto.preset, dto.folder);
  }
}
