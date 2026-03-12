import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ColorRepository } from './repositories/color.repository';
import { ColorDto } from './dto/color.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { Color } from './entities/color.entity';
import { ColorFilters } from './repositories/color.repository.entity';

@Injectable()
export class ColorsService {
  private readonly logger = new Logger(ColorsService.name);

  constructor(
    private readonly colorRepository: ColorRepository,
  ) {}

  async findAll(filters: ColorFilters) {
    return await this.colorRepository.findWithFilters(filters);
  }

  async findByIds(ids: string[]): Promise<Color[]> {
    return await this.colorRepository.findByIds(ids);
  }

  async create(createColorDto: CreateColorDto): Promise<Color> {
    // Normalizar hexCode a mayúsculas
    const hexCode = createColorDto.hexCode.toUpperCase();
    
    // Validar duplicado
    const existing = await this.colorRepository.findByHexCode(hexCode);
    if (existing) {
      throw new BadRequestException(`Ya existe un color con el código ${hexCode}`);
    }
    
    // Crear color
    const color = this.colorRepository.create({
      name: createColorDto.name.trim(),
      hexCode,
      active: true, // Por defecto activo
    });
    
    return await this.colorRepository.save(color);
  }

  async update(id: string, updateColorDto: UpdateColorDto): Promise<Color> {
    // Buscar color existente
    const color = await this.colorRepository.findOne({ where: { id } });
    if (!color) {
      throw new NotFoundException('Color no encontrado');
    }
    
    // Si se actualiza hexCode, validar duplicado
    if (updateColorDto.hexCode) {
      const hexCode = updateColorDto.hexCode.toUpperCase();
      const existing = await this.colorRepository.findByHexCode(hexCode);
      if (existing && existing.id !== id) {
        throw new BadRequestException(`Ya existe un color con el código ${hexCode}`);
      }
      updateColorDto.hexCode = hexCode;
    }

    // Si se actualiza name, limpiar espacios
    if (updateColorDto.name) {
      updateColorDto.name = updateColorDto.name.trim();
    }
    
    // Actualizar
    Object.assign(color, updateColorDto);
    return await this.colorRepository.save(color);
  }

  async seedDefaultColors(): Promise<void> {
    const defaultColors = [
      { name: 'Negro', hexCode: '#000000' },
      { name: 'Blanco', hexCode: '#FFFFFF' },
      { name: 'Rojo', hexCode: '#FF0000' },
      { name: 'Azul', hexCode: '#0000FF' },
      { name: 'Verde', hexCode: '#008000' },
      { name: 'Gris', hexCode: '#808080' },
    ];

    for (const colorData of defaultColors) {
      const existingColor = await this.colorRepository.findByHexCode(colorData.hexCode);
      if (!existingColor) {
        const color = this.colorRepository.create({
          ...colorData,
          active: true,
        });
        await this.colorRepository.save(color);
        this.logger.log(`✅ Created default color: ${colorData.name} (${colorData.hexCode})`);
      }
    }
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
