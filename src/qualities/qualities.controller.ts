import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { QualitiesService } from './qualities.service';
import {
  CreateQualityDto,
  UpdateQualityDto,
  QualityQueryDto,
} from './dto/quality.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  @UseGuards(JwtAuthGuard)
  async create(@Body() createQualityDto: CreateQualityDto) {
    return await this.qualitiesService.create(createQualityDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateQualityDto: UpdateQualityDto,
  ) {
    const quality = await this.qualitiesService.update(id, updateQualityDto);
    if (!quality) {
      throw new NotFoundException('Quality not found');
    }
    return quality;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    const success = await this.qualitiesService.remove(id);
    if (!success) {
      throw new NotFoundException('Quality not found');
    }
    return { message: 'Quality deleted successfully' };
  }
}
