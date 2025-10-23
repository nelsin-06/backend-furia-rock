import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from '../entities/cart-item.entity';

@Injectable()
export class CartItemRepository {
  constructor(
    @InjectRepository(CartItem)
    private readonly repository: Repository<CartItem>,
  ) {}

  // Find item by cart and product
  async findByCartAndProduct(
    cartId: string,
    productId: string,
  ): Promise<CartItem | null> {
    return this.repository.findOne({
      where: { cartId, productId },
    });
  }

  // Create cart item
  create(data: Partial<CartItem>): CartItem {
    return this.repository.create(data);
  }

  // Save cart item
  async save(item: CartItem): Promise<CartItem> {
    return this.repository.save(item);
  }

  // Delete cart item
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  // Delete all items from cart
  async deleteByCartId(cartId: string): Promise<void> {
    await this.repository.delete({ cartId });
  }
}
