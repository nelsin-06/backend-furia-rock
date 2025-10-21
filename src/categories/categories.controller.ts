import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryQueryDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  async findAll(@Query() query: CategoryQueryDto) {
    return await this.categoriesService.findAll(query);
  }

  @Get('default')
  async getDefault() {
    return await this.categoriesService.getDefaultCategory();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findOne(id);
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return await this.categoriesService.create(createCategoryDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateCategoryDto: UpdateCategoryDto
  ) {
    const category = await this.categoriesService.update(id, updateCategoryDto);
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const deleted = await this.categoriesService.remove(id);
    if (!deleted) {
      throw new Error('Category not found');
    }
  }
}