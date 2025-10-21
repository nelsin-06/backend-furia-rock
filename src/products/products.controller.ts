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
  UseInterceptors,
  UploadedFiles,
  BadRequestException
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ProductService } from './products.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';
import { ImageUploadService } from '../image-upload/image-upload.service';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly imageUploadService: ImageUploadService,
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
  // @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'images', maxCount: 20 }],
      {
        limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
        fileFilter: (_req, file, cb) => {
          if (!file.mimetype.startsWith('image/')) {
            return cb(new BadRequestException('Only images are allowed'), false);
          }
          cb(null, true);
        },
      },
    ),
  )
  async create(
    @Body() createProductDto: CreateProductDto,//CreateProductDto,
    @UploadedFiles() files: { images?: Express.Multer.File[] },
  ) {
    
    // First create the product to get an ID
    const product = await this.productService.create(createProductDto);

    // If files are uploaded, process them
    if (files.images && files.images.length > 0) {
      // Upload images to Cloudinary
      const imageUrls = await Promise.all(
        files.images.map((file) => this.imageUploadService.upload(file, product.id)),
      );

      // Update product variables with uploaded images
      if (product.variables && product.variables.length > 0) {
        // Distribute images among variables (round-robin assignment)
        let imageIndex = 0;
        product.variables.forEach((variable) => {
          const imagesForVariable = [];
          // Assign at least one image per variable if available
          if (imageIndex < imageUrls.length) {
            imagesForVariable.push(imageUrls[imageIndex]);
            imageIndex++;
          }
          variable.images = imagesForVariable;
        });

        // Update the product with image URLs
        return await this.productService.update(product.id, { variables: product.variables });
      }
    }

    return product;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    const product = await this.productService.update(id, updateProductDto);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const success = await this.productService.remove(id);
    if (!success) {
      throw new Error('Product not found');
    }
    return { message: 'Product deleted successfully' };
  }
}
