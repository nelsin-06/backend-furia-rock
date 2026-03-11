import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

/**
 * Request DTO for generating a Cloudinary signed upload signature.
 *
 * - `preset` must be one of the allowed upload presets (allowlist).
 * - `folder` is optional; if provided it must start with "furia-rock/"
 *   and may contain subcarpetas (e.g. "furia-rock/products/123").
 */
export class GenerateSignatureDto {
  @IsString()
  @IsNotEmpty()
  preset: string;

  @IsOptional()
  @IsString()
  @Matches(/^furia-rock\/([\w\-.]+\/?)*$/, {
    message:
      'folder must start with "furia-rock/" and may only contain alphanumeric characters, hyphens, underscores, dots, and forward slashes',
  })
  folder?: string;
}
