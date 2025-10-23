import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Get current cart
  @Get()
  async getCart(@Headers('x-session-id') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }
    return await this.cartService.getCart(sessionId);
  }

  // Add item to cart
  @Post('items')
  async addItem(
    @Headers('x-session-id') sessionId: string,
    @Body() addItemDto: AddCartItemDto,
  ) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }
    return await this.cartService.addItem(sessionId, addItemDto);
  }

  // Update item quantity
  @Patch('items/:itemId')
  async updateItem(
    @Headers('x-session-id') sessionId: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: UpdateCartItemDto,
  ) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }
    return await this.cartService.updateItem(sessionId, itemId, updateItemDto);
  }

  // Remove item from cart
  @Delete('items/:itemId')
  async removeItem(
    @Headers('x-session-id') sessionId: string,
    @Param('itemId') itemId: string,
  ) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }
    return await this.cartService.removeItem(sessionId, itemId);
  }

  // Clear cart
  @Delete('clear')
  async clearCart(@Headers('x-session-id') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }
    return await this.cartService.clearCart(sessionId);
  }

  // Delete cart completely
  @Delete()
  async deleteCart(@Headers('x-session-id') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }
    await this.cartService.deleteCart(sessionId);
    return { message: 'Cart deleted successfully' };
  }
}
