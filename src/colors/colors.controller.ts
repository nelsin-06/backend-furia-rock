import { 
  Controller, 
  Get, 
  Post,
  Patch,
  Body,
  Param,
  Query, 
  UseGuards,
} from '@nestjs/common';
import { ColorsService } from './colors.service';
import { ColorQueryDto } from './dto/color.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('colors')
export class ColorsController {
  constructor(
    private readonly colorsService: ColorsService,
  ) {}

  @Get()
  async findAll(@Query() query: ColorQueryDto) {
    return await this.colorsService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createColorDto: CreateColorDto) {
    return await this.colorsService.create(createColorDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateColorDto: UpdateColorDto) {
    return await this.colorsService.update(id, updateColorDto);
  }
}