import { Controller, Get, Param, Query, Patch, Body, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderQueryDto, UpdateTrackingDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@Query() query: OrderQueryDto) {
    return await this.ordersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.ordersService.findOne(id);
  }

  @Patch(':id/tracking')
  async updateTracking(
    @Param('id') id: string,
    @Body() updateTrackingDto: UpdateTrackingDto,
  ) {
    return await this.ordersService.updateTracking(id, updateTrackingDto);
  }
}
