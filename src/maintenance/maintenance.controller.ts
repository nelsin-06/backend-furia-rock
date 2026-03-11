import { Controller, Post, UseGuards, Logger, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from '../cart/cart.service';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  private readonly logger = new Logger(MaintenanceController.name);

  constructor(private readonly cartService: CartService) {}

  @Post('carts/cleanup')
  @HttpCode(200)
  async cleanupExpiredCarts() {
    this.logger.log('Manual cart cleanup triggered via maintenance endpoint');

    const deletedCount = await this.cartService.cleanupExpiredCarts();

    this.logger.log(`Cart cleanup completed. Deleted ${deletedCount} expired carts.`);

    return {
      message: 'Cart cleanup completed',
      deletedCount,
    };
  }
}
