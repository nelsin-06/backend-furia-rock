import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { AdminModule } from './admin/admin.module';
import { ImageUploadModule } from './image-upload/image-upload.module';
import { ColorsModule } from './colors/colors.module';
import { CategoriesModule } from './categories/categories.module';
import { QualitiesModule } from './qualities/qualities.module';
import { CartModule } from './cart/cart.module';
import { PaymentModule } from './payments/payment.module';
import { OrdersModule } from './orders/orders.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { Admin } from './admin/entities/admin.entity';
import { Product } from './products/entities/product.entity';
import { Color } from './colors/entities/color.entity';
import { Category } from './categories/entities/category.entity';
import { Quality } from './qualities/entities/quality.entity';
import { Cart } from './cart/entities/cart.entity';
import { CartItem } from './cart/entities/cart-item.entity';
import { Order } from './orders/entities/order.entity';

const bootstrapLogger = new Logger('AppModuleBootstrap');

@Module({
  imports: [
    // ConfigModule MUST be first — it loads env vars that TypeOrmModule needs.
    // In Lambda, env vars come from SAM template (no .env files needed).
    // Locally, it loads from .env.development or .env.production.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    // TypeOrmModule uses forRootAsync so it waits for ConfigModule to load
    // env vars before reading DB_* values via ConfigService.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV', 'development');
        const isDev = nodeEnv === 'development';
        const dbHost = config.get<string>('DB_HOST', 'localhost');

        bootstrapLogger.log(
          `TypeORM: NODE_ENV=${nodeEnv}, host=${dbHost}, db=${config.get('DB_DATABASE')}`,
        );

        return {
          type: 'postgres',
          host: dbHost,
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE'),
          entities: [
            Admin,
            Product,
            Color,
            Category,
            Quality,
            Cart,
            CartItem,
            Order,
          ],
          // synchronize ONLY in development — production must use migrations
          synchronize: true,
          logging: isDev,
          // Enable SSL for non-local hosts (e.g. managed Postgres like Neon)
          ssl:
            dbHost && dbHost !== 'localhost'
              ? { rejectUnauthorized: false }
              : false,
          // Connection pool tuning for Lambda:
          // - Lambda handles 1 concurrent request per container, so a small pool
          //   suffices. A pool of 2 avoids contention while limiting Neon connections.
          // - Local dev uses a larger pool for concurrent requests.
          extra: {
            max: isDev ? 10 : 2,
          },
        };
      },
    }),
    AuthModule,
    ProductsModule,
    AdminModule,
    ImageUploadModule,
    ColorsModule,
    CategoriesModule,
    QualitiesModule,
    CartModule,
    PaymentModule,
    OrdersModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
