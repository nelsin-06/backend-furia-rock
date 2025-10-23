import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { AdminModule } from './admin/admin.module';
import { ImageUploadModule } from './image-upload/image-upload.module';
import { ColorsModule } from './colors/colors.module';
import { CategoriesModule } from './categories/categories.module';
import { QualitiesModule } from './qualities/qualities.module';
import { CartModule } from './cart/cart.module';
import { Admin } from './admin/entities/admin.entity';
import { Product } from './products/entities/product.entity';
import { Color } from './colors/entities/color.entity';
import { Category } from './categories/entities/category.entity';
import { Quality } from './qualities/entities/quality.entity';
import { Cart } from './cart/entities/cart.entity';
import { CartItem } from './cart/entities/cart-item.entity';
import { AdminRepository } from './admin/repositories/admin.repository';
import { CategoriesService } from './categories/categories.service';
import { QualitiesService } from './qualities/qualities.service';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { ConfigModule } from '@nestjs/config';
dotenv.config();

console.log('Loading environment variables...', process.env.NODE_ENV);
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'furia_rock',
      entities: [Admin, Product, Color, Category, Quality, Cart, CartItem],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    ProductsModule,
    AdminModule,
    ImageUploadModule,
    ColorsModule,
    CategoriesModule,
    QualitiesModule,
    CartModule,
    ConfigModule.forRoot({
      isGlobal: true, // Hace que las variables sean accesibles globalmente
    }),
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly categoriesService: CategoriesService,
    private readonly qualitiesService: QualitiesService,
  ) {}

  async onModuleInit() {
    await this.seedSuperAdmin();
    await this.seedDefaultCategories();
    await this.seedDefaultQualities();
  }

  private async seedSuperAdmin() {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await this.adminRepository.findByUsername(
      adminUsername,
    );

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const admin = this.adminRepository.create({
        username: adminUsername,
        passwordHash,
      });

      await this.adminRepository.save(admin);
      console.log(`Super admin created with username: ${adminUsername}`);
    }
  }

  private async seedDefaultCategories() {
    try {
      await this.categoriesService.ensureDefaultCategoryExists();
    } catch (error) {
      console.error('Error seeding default categories:', error);
    }
  }

  private async seedDefaultQualities() {
    try {
      await this.qualitiesService.seedDefaultQualities();
    } catch (error) {
      console.error('Error seeding default qualities:', error);
    }
  }
}
