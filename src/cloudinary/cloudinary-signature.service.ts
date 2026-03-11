import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v2 as Cloudinary } from 'cloudinary';

/**
 * Allowed upload presets. Only these values are accepted by the signature
 * endpoint — prevents attackers from using arbitrary presets even with a
 * valid admin JWT.
 */
const ALLOWED_PRESETS = new Set(['products']);

@Injectable()
export class CloudinarySignatureService {
  private readonly logger = new Logger(CloudinarySignatureService.name);

  constructor(
    @Inject('CLOUDINARY') private readonly cloudinary: typeof Cloudinary,
  ) {}

  /**
   * Generates a signed-upload parameter set that the frontend can use to
   * upload directly to Cloudinary without the binary passing through the
   * backend.
   *
   * @param preset  Upload preset name (must be in ALLOWED_PRESETS)
   * @param folder  Optional folder path (must start with "furia-rock/")
   * @returns       Object containing all params needed for the frontend upload
   */
  generateSignature(preset: string, folder?: string) {
    // --- Preset allowlist ---
    if (!ALLOWED_PRESETS.has(preset)) {
      throw new BadRequestException(
        `Upload preset "${preset}" is not allowed. Allowed presets: ${[...ALLOWED_PRESETS].join(', ')}`,
      );
    }

    // --- Folder validation (redundant safety net — DTO already validates) ---
    if (folder && !folder.startsWith('furia-rock/')) {
      throw new BadRequestException(
        'folder must start with "furia-rock/"',
      );
    }

    const timestamp = Math.round(Date.now() / 1000);

    // Parameters that Cloudinary will verify against the signature.
    // The order does not matter — api_sign_request sorts them internally.
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      upload_preset: preset,
    };

    if (folder) {
      paramsToSign.folder = folder;
    }

    // cloudinary.utils.api_sign_request uses CLOUDINARY_API_SECRET
    // (configured in CloudinaryModule) to produce the SHA-1 signature.
    const signature = this.cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET,
    );

    this.logger.log(
      `Generated signed upload params — preset: ${preset}, folder: ${folder ?? '(none)'}`,
    );

    return {
      signature,
      timestamp,
      upload_preset: preset,
      ...(folder ? { folder } : {}),
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }
}
