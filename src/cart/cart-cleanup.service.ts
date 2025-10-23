import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { CartService } from './cart.service';

@Injectable()
export class CartCleanupService implements OnModuleInit {
  private readonly logger = new Logger(CartCleanupService.name);

  constructor(private readonly cartService: CartService) {}

  onModuleInit() {
    // Run every day at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      this.logger.log('Starting cart cleanup task...');

      try {
        const deletedCount = await this.cartService.cleanupExpiredCarts();
        this.logger.log(`Cart cleanup completed. Deleted ${deletedCount} expired carts.`);
      } catch (error) {
        this.logger.error('Cart cleanup failed', error);
      }
    });

    this.logger.log('Cart cleanup cron job initialized (runs daily at 3:00 AM)');
  }
}
