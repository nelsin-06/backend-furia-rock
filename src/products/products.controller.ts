import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  CloneProductDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
  ) {}

  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    return await this.productService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productService.findOne(id);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createProductDto: CreateProductDto, //CreateProductDto,
  ) {
    // First create the product and return it (image uploads happen via variant images endpoints)
    return await this.productService.create(createProductDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productService.update(id, updateProductDto);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    const success = await this.productService.remove(id);
    if (!success) {
      throw new Error('Product not found');
    }
    return { message: 'Product deleted successfully' };
  }

  @Post(':id/clone')
  @UseGuards(JwtAuthGuard)
  async clone(
    @Param('id') id: string,
    @Body() cloneDto: CloneProductDto,
  ) {
    return await this.productService.cloneProduct(id, cloneDto);
  }
}
