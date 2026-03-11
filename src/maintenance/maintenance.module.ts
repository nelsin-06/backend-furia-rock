import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [CartModule],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
