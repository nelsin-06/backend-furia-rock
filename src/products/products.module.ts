import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './products.controller';
import { ProductVariantImagesController } from './product-variant-images.controller';
import { ProductService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductRepository } from './repositories/product.repository';
import { ImageUploadModule } from '../image-upload/image-upload.module';
import { ColorsModule } from '../colors/colors.module';
import { CategoriesModule } from '../categories/categories.module';
import { QualitiesModule } from '../qualities/qualities.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    ImageUploadModule,
    ColorsModule,
    CategoriesModule,
    QualitiesModule,
  ],
  controllers: [ProductController, ProductVariantImagesController],
  providers: [ProductService, ProductRepository],
  exports: [ProductService, ProductRepository],
})
export class ProductsModule {}
