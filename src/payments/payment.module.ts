import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Order } from '../orders/entities/order.entity';
import { OrderRepository } from '../orders/repositories/order.repository';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { MailModule } from '../mail/mail.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ColorsModule } from '../colors/colors.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ConfigModule,
    CartModule,
    ProductsModule,
    MailModule,
    TelegramModule,
    ColorsModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, OrderRepository],
  exports: [PaymentService, OrderRepository],
})
export class PaymentModule {}
