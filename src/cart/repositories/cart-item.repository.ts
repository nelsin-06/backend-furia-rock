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

  // Find item by cart, product, variant, and size
  async findByCartProductVariantAndSize(
    cartId: string,
    productId: string,
    variantId: string,
    talla: string,
  ): Promise<CartItem | null> {
    return this.repository.findOne({
      where: { cartId, productId, variantId, talla },
    });
  }

  // Find item by cart and product (legacy method - keep for backward compatibility)
  async findByCartAndItemId(
    cartId: string,
    itemId: string,
  ): Promise<CartItem | null> {
    console.log("🚀 ~ CartItemRepository ~ findByCartAndItemId ~ itemId:", itemId)
    console.log("🚀 ~ CartItemRepository ~ findByCartAndItemId ~ cartId:", cartId)
    return this.repository.findOne({
      where: { cartId, id: itemId },
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

  // Find all items by productId
  async findByProductId(productId: string): Promise<CartItem[]> {
    return this.repository.find({
      where: { productId },
    });
  }

  // Find all items by productId and variantId
  async findByProductAndVariant(productId: string, variantId: string): Promise<CartItem[]> {
    return this.repository.find({
      where: { productId, variantId },
    });
  }

  // Delete items by productId
  async deleteByProductId(productId: string): Promise<void> {
    await this.repository.delete({ productId });
  }

  // Delete items by productId and variantId
  async deleteByProductAndVariant(productId: string, variantId: string): Promise<void> {
    await this.repository.delete({ productId, variantId });
  }
}
