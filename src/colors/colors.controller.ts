import { 
  Controller, 
  Get, 
  Query, 
} from '@nestjs/common';
import { ColorsService } from './colors.service';
import { ColorQueryDto } from './dto/color.dto';

@Controller('colors')
export class ColorsController {
  constructor(
    private readonly colorsService: ColorsService,
  ) {}

  @Get()
  async findAll(@Query() query: ColorQueryDto) {
    return await this.colorsService.findAll(query);
  }
}