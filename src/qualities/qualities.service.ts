import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { QualityRepository } from './repositories/quality.repository';
import { CreateQualityDto, UpdateQualityDto, QualityDto } from './dto/quality.dto';
import { Quality } from './entities/quality.entity';
import { QualityFilters } from './repositories/quality.repository.entity';

@Injectable()
export class QualitiesService {
  private readonly logger = new Logger(QualitiesService.name);

  constructor(
    private readonly qualityRepository: QualityRepository,
  ) {}

  async findAll(filters: QualityFilters) {
    return await this.qualityRepository.findWithFilters(filters);
  }

  async findOne(id: string): Promise<QualityDto | null> {
    const quality = await this.qualityRepository.findById(id);
    return quality ? this.mapToDto(quality) : null;
  }

  async findByName(name: string): Promise<QualityDto | null> {
    const quality = await this.qualityRepository.findByName(name);
    return quality ? this.mapToDto(quality) : null;
  }

  async findByIds(ids: string[]): Promise<Quality[]> {
    return this.qualityRepository.findByIds(ids);
  }

  async create(createQualityDto: CreateQualityDto): Promise<QualityDto> {
    // Check if quality name already exists
    const existingQuality = await this.qualityRepository.findByName(createQualityDto.name);
    if (existingQuality) {
      throw new BadRequestException(`Quality with name "${createQualityDto.name}" already exists`);
    }

    const quality = this.qualityRepository.create({
      name: createQualityDto.name.toLowerCase(),
      description: createQualityDto.description,
      active: createQualityDto.active ?? true,
    });

    const savedQuality = await this.qualityRepository.save(quality);
    return this.mapToDto(savedQuality);
  }

  async update(id: string, updateQualityDto: UpdateQualityDto): Promise<QualityDto | null> {
    const existingQuality = await this.qualityRepository.findOne({ where: { id } });
    if (!existingQuality) {
      throw new NotFoundException('Quality not found');
    }

    // Check if new name conflicts with existing quality (if name is being updated)
    if (updateQualityDto.name && updateQualityDto.name !== existingQuality.name) {
      const conflictingQuality = await this.qualityRepository.findByName(updateQualityDto.name);
      if (conflictingQuality && conflictingQuality.id !== id) {
        throw new BadRequestException(`Quality with name "${updateQualityDto.name}" already exists`);
      }
    }

    const updateData = {
      name: updateQualityDto.name?.toLowerCase(),
      description: updateQualityDto.description,
      active: updateQualityDto.active,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    await this.qualityRepository.update(id, updateData);

    const updatedQuality = await this.qualityRepository.findOne({ where: { id } });
    return updatedQuality ? this.mapToDto(updatedQuality) : null;
  }

  async remove(id: string): Promise<boolean> {
    const quality = await this.qualityRepository.findOne({ where: { id } });
    if (!quality) {
      return false;
    }

    // TODO: Add check to prevent deletion if quality is used by products
    // const productsUsingQuality = await this.productRepository.findByQuality(id);
    // if (productsUsingQuality.length > 0) {
    //   throw new BadRequestException('Cannot delete quality that is used by products');
    // }

    await this.qualityRepository.delete(id);
    return true;
  }

  async seedDefaultQualities(): Promise<void> {
    const defaultQualities = [
      { name: 'premium', description: 'Calidad premium con materiales de alta gama' },
      { name: 'intermedia', description: 'Calidad intermedia con buen balance precio-calidad' },
      { name: 'basica', description: 'Calidad básica accesible para todos' },
    ];

    for (const qualityData of defaultQualities) {
      const existingQuality = await this.qualityRepository.findByName(qualityData.name);
      if (!existingQuality) {
        const quality = this.qualityRepository.create(qualityData);
        await this.qualityRepository.save(quality);
        this.logger.log(`✅ Created default quality: ${qualityData.name}`);
      }
    }
  }

  private mapToDto(quality: Quality): QualityDto {
    return {
      id: quality.id,
      name: quality.name,
      description: quality.description,
      active: quality.active,
      createdAt: quality.createdAt,
      updatedAt: quality.updatedAt,
    };
  }
}