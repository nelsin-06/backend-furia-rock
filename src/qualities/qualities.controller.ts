import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  Query,
  NotFoundException 
} from '@nestjs/common';
import { QualitiesService } from './qualities.service';
import { CreateQualityDto, UpdateQualityDto, QualityQueryDto } from './dto/quality.dto';

@Controller('qualities')
export class QualitiesController {
  constructor(private readonly qualitiesService: QualitiesService) {}

  @Get()
  async findAll(@Query() query: QualityQueryDto) {
    return await this.qualitiesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const quality = await this.qualitiesService.findOne(id);
    if (!quality) {
      throw new NotFoundException('Quality not found');
    }
    return quality;
  }

  @Post()
  async create(@Body() createQualityDto: CreateQualityDto) {
    return await this.qualitiesService.create(createQualityDto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateQualityDto: UpdateQualityDto) {
    const quality = await this.qualitiesService.update(id, updateQualityDto);
    if (!quality) {
      throw new NotFoundException('Quality not found');
    }
    return quality;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const success = await this.qualitiesService.remove(id);
    if (!success) {
      throw new NotFoundException('Quality not found');
    }
    return { message: 'Quality deleted successfully' };
  }
}