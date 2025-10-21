import { Injectable } from '@nestjs/common';
import { ColorRepository } from './repositories/color.repository';
import { ColorDto } from './dto/color.dto';
import { Color } from './entities/color.entity';
import { ColorFilters } from './repositories/color.repository.entity';

@Injectable()
export class ColorsService {
  constructor(
    private readonly colorRepository: ColorRepository,
  ) {}

  async findAll(filters: ColorFilters) {
    return await this.colorRepository.findWithFilters(filters);
  }

  async findByIds(ids: string[]): Promise<Color[]> {
    return await this.colorRepository.findByIds(ids);
  }

  private mapToDto(color: Color): ColorDto {
    return {
      id: color.id,
      name: color.name,
      hexCode: color.hexCode,
      active: color.active,
      createdAt: color.createdAt,
    };
  }
}