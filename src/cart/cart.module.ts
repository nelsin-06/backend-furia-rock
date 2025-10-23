import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './repositories/cart.repository';
import { CartItemRepository } from './repositories/cart-item.repository';
import { CartCleanupService } from './cart-cleanup.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    ProductsModule,
  ],
  controllers: [CartController],
  providers: [
    CartService,
    CartRepository,
    CartItemRepository,
    CartCleanupService,
  ],
  exports: [CartService],
})
export class CartModule {}
