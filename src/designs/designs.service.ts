import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { v2 as Cloudinary, UploadApiResponse } from 'cloudinary';
import { Design, DesignStatus } from './entities/design.entity';
import { DesignRepository } from './repositories/design.repository';
import {
  CreateDesignDto,
  UpdateDesignMetadataDto,
  UpdateDesignStatusDto,
  AdminUpdateDesignDto,
  AdminDesignQueryDto,
} from './dto/design.dto';

const MAX_ASSETS_PER_DESIGN = 30;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

@Injectable()
export class DesignsService {
  private readonly logger = new Logger(DesignsService.name);

  constructor(
    private readonly designRepository: DesignRepository,
    @Inject('CLOUDINARY') private readonly cloudinary: typeof Cloudinary,
  ) {}

  // ─── Public endpoints ────────────────────────────────────────────────────────

  async create(dto: CreateDesignDto): Promise<{ id: string }> {
    const design = this.designRepository.create({
      designName: dto.designName,
      customerName: dto.customerName,
      phone: dto.phone,
      status: DesignStatus.DRAFT,
      assets: [],
      metadata: {},
    });

    const saved = await this.designRepository.save(design);
    return { id: saved.id };
  }

  async updateMetadata(
    id: string,
    dto: UpdateDesignMetadataDto,
  ): Promise<Design> {
    const design = await this.findOneOrFail(id);
    if (dto.metadata !== undefined) {
      design.metadata = dto.metadata;
    }
    return await this.designRepository.save(design);
  }

  async uploadAsset(
    id: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const design = await this.findOneOrFail(id);

    // Validation: max assets
    const currentAssets = design.assets ?? [];
    if (currentAssets.length >= MAX_ASSETS_PER_DESIGN) {
      throw new BadRequestException(
        `Maximum of ${MAX_ASSETS_PER_DESIGN} assets per design reached.`,
      );
    }

    // Validation: file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds the 10 MB limit (received ${(file.size / 1024 / 1024).toFixed(2)} MB).`,
      );
    }

    // Validation: mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Allowed types: PNG, JPG, SVG.`,
      );
    }

    const url = await this.uploadToCloudinary(
      file.buffer,
      `user-designs/${id}/assets`,
    );

    design.assets = [...currentAssets, url];
    await this.designRepository.save(design);

    return { url };
  }

  async finalize(
    id: string,
    frontFile: Express.Multer.File,
    backFile: Express.Multer.File,
  ): Promise<Design> {
    const design = await this.findOneOrFail(id);

    if (design.status === DesignStatus.SUBMITTED) {
      throw new BadRequestException('Design has already been finalized.');
    }

    this.logger.log(`Finalizing design ${id}: uploading front and back renders`);

    const [frontImageUrl, backImageUrl] = await Promise.all([
      this.uploadToCloudinary(
        frontFile.buffer,
        `user-designs/${id}/renders`,
        'front',
      ),
      this.uploadToCloudinary(
        backFile.buffer,
        `user-designs/${id}/renders`,
        'back',
      ),
    ]);

    design.frontImageUrl = frontImageUrl;
    design.backImageUrl = backImageUrl;
    design.status = DesignStatus.SUBMITTED;

    return await this.designRepository.save(design);
  }

  async getPublicById(id: string): Promise<Partial<Design>> {
    const design = await this.findOneOrFail(id);
    // Return only public fields
    return {
      id: design.id,
      designName: design.designName,
      frontImageUrl: design.frontImageUrl,
      backImageUrl: design.backImageUrl,
      status: design.status,
      createdAt: design.createdAt,
    };
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────────

  async findAll(filters: AdminDesignQueryDto) {
    return await this.designRepository.findWithFilters(filters);
  }

  async findOneAdmin(id: string): Promise<Design> {
    return await this.findOneOrFail(id);
  }

  async updateStatus(id: string, dto: UpdateDesignStatusDto): Promise<Design> {
    const design = await this.findOneOrFail(id);
    design.status = dto.status;
    return await this.designRepository.save(design);
  }

  async updateDesignAdmin(id: string, dto: AdminUpdateDesignDto): Promise<Design> {
    const design = await this.findOneOrFail(id);
    if (dto.status !== undefined) design.status = dto.status;
    if (dto.designName !== undefined) design.designName = dto.designName;
    if (dto.customerName !== undefined) design.customerName = dto.customerName;
    if (dto.phone !== undefined) design.phone = dto.phone;
    return await this.designRepository.save(design);
  }

  async deleteDesign(id: string): Promise<void> {
    const design = await this.findOneOrFail(id);
    await this.designRepository.remove(design);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async findOneOrFail(id: string): Promise<Design> {
    const design = await this.designRepository.findOne({ where: { id } });
    if (!design) {
      throw new NotFoundException(`Design with ID ${id} not found.`);
    }
    return design;
  }

  private uploadToCloudinary(
    buffer: Buffer,
    folder: string,
    publicId?: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: Record<string, unknown> = {
        folder,
        resource_type: 'image',
        quality: 'auto:good',
        fetch_format: 'auto',
      };

      if (publicId) {
        options.public_id = publicId;
        options.overwrite = true;
      }

      const stream = this.cloudinary.uploader.upload_stream(
        options,
        (error, result: UploadApiResponse) => {
          if (error) {
            return reject(new BadRequestException(error.message));
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }
}
