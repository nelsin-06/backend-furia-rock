import { Module, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { DesignsModule } from './designs/designs.module';
import { Design } from './designs/entities/design.entity';
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
    // Rate limiting — applied globally via APP_GUARD + ThrottlerGuard.
    // Three tiers to balance UX and protection:
    //   short:  20 req / 1 s   (burst protection)
    //   medium: 100 req / 30 s (sustained API use)
    //   long:   300 req / 5 min (scraping/DDoS protection)
    // Admin routes are exempt via @SkipThrottle() in the admin controller.
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,   limit: 20 },
      { name: 'medium', ttl: 30000,  limit: 100 },
      { name: 'long',   ttl: 300000, limit: 300 },
    ]),
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
            Design,
          ],
          // synchronize ONLY in development — production must use migrations
          synchronize: isDev,
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
    DesignsModule,
  ],
  providers: [
    // Register ThrottlerGuard globally so all routes are rate-limited.
    // Use APP_GUARD (DI token) instead of useGlobalGuards() so the guard
    // can inject ThrottlerStorage provided by ThrottlerModule.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
