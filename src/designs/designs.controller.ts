import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DesignsService } from './designs.service';
import {
  CreateDesignDto,
  UpdateDesignMetadataDto,
  UpdateDesignStatusDto,
  AdminDesignQueryDto,
} from './dto/design.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ─── Public routes (/designs) ─────────────────────────────────────────────────

@ApiTags('Designs')
@Controller('designs')
export class DesignsController {
  constructor(private readonly designsService: DesignsService) {}

  /**
   * POST /designs
   * Creates a new draft design with customer data.
   * Returns { id: string }.
   */
  @Post()
  async create(@Body() dto: CreateDesignDto) {
    return await this.designsService.create(dto);
  }

  /**
   * PATCH /designs/:id
   * Partially updates the editor metadata (layers, positions, scale, etc.).
   */
  @Patch(':id')
  async updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignMetadataDto,
  ) {
    return await this.designsService.updateMetadata(id, dto);
  }

  /**
   * POST /designs/:id/assets
   * Uploads a single logo file to Cloudinary and stores the URL.
   * Accepts: PNG, JPG, SVG — max 10 MB — max 30 per design.
   */
  @Post(':id/assets')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.designsService.uploadAsset(id, file);
  }

  /**
   * POST /designs/:id/finalize
   * Receives front.png and back.png previews, uploads them to Cloudinary,
   * and sets status = 'submitted'.
   */
  @Post(':id/finalize')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'front', maxCount: 1 },
      { name: 'back', maxCount: 1 },
    ]),
  )
  async finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles()
    files: { front?: Express.Multer.File[]; back?: Express.Multer.File[] },
  ) {
    return await this.designsService.finalize(
      id,
      files.front?.[0],
      files.back?.[0],
    );
  }

  /**
   * GET /designs/:id
   * Public read-only view: returns front/back image URLs + basic metadata.
   */
  @Get(':id')
  async getPublic(@Param('id', ParseUUIDPipe) id: string) {
    return await this.designsService.getPublicById(id);
  }
}

// ─── Admin routes (/admin/designs) ───────────────────────────────────────────

@ApiTags('Admin - Designs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipThrottle()  // Admin endpoints are JWT-protected; no need to rate-limit them.
@Controller('admin/designs')
export class AdminDesignsController {
  constructor(private readonly designsService: DesignsService) {}

  /**
   * GET /admin/designs
   * Lists all designs with optional filters: status, date range, search.
   */
  @Get()
  async findAll(@Query() query: AdminDesignQueryDto) {
    return await this.designsService.findAll(query);
  }

  /**
   * GET /admin/designs/:id
   * Full design detail: assets, metadata, preview images.
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.designsService.findOneAdmin(id);
  }

  /**
   * PATCH /admin/designs/:id
   * Update design status (contacted, closed).
   */
  @Patch(':id')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignStatusDto,
  ) {
    return await this.designsService.updateStatus(id, dto);
  }
}
