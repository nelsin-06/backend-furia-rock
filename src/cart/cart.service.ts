import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CartRepository } from './repositories/cart.repository';
import { CartItemRepository } from './repositories/cart-item.repository';
import { Cart, CartStatus } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { ProductService } from '../products/products.service';

@Injectable()
export class CartService {
  // Cart expiration: 15 days from last interaction
  private readonly CART_EXPIRATION_DAYS = 15;

  constructor(
    private readonly cartRepository: CartRepository,
    private readonly cartItemRepository: CartItemRepository,
    private readonly productService: ProductService,
  ) {}

  // Get or create cart for session
  async getOrCreateCart(sessionId: string): Promise<Cart> {
    // Try to find active cart
    let cart = await this.cartRepository.findActiveBySessionId(sessionId);

    // If cart exists, check if expired
    if (cart) {
      if (new Date() > cart.expiresAt) {
        // Mark as abandoned and create new one
        cart.status = CartStatus.ABANDONED;
        await this.cartRepository.save(cart);
        cart = null;
      }
    }

    // Create new cart if needed
    if (!cart) {
      cart = this.cartRepository.create({
        sessionId,
        status: CartStatus.ACTIVE,
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        expiresAt: this.calculateExpirationDate(),
      });
      cart = await this.cartRepository.save(cart);
    }

    return cart;
  }

  // Get cart by sessionId
  async getCart(sessionId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(sessionId);
    return cart;
  }

  // Add item to cart
  async addItem(
    sessionId: string,
    addItemDto: AddCartItemDto,
  ): Promise<Cart> {
    const cart = await this.getOrCreateCart(sessionId);

    // Validate product exists and get current price
    const product = await this.productService.findOne(addItemDto.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.active) {
      throw new BadRequestException('Product is not available');
    }

    // Check if item already exists in cart
    let cartItem = await this.cartItemRepository.findByCartAndProduct(
      cart.id,
      addItemDto.productId,
    );

    if (cartItem) {
      // Update quantity
      cartItem.quantity += addItemDto.quantity;
      cartItem.total = this.calculateItemTotal(
        cartItem.quantity,
        Number(product.price),
        cartItem.discount,
      );
      await this.cartItemRepository.save(cartItem);
    } else {
      // Create new item
      cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId: addItemDto.productId,
        quantity: addItemDto.quantity,
        price: Number(product.price),
        discount: 0, // No discount by default
        total: this.calculateItemTotal(
          addItemDto.quantity,
          Number(product.price),
          0,
        ),
      });
      await this.cartItemRepository.save(cartItem);
    }

    // Extend expiration and recalculate totals
    return await this.updateCartTotals(cart.id);
  }

  // Update item quantity
  async updateItem(
    sessionId: string,
    itemId: string,
    updateItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const cart = await this.getOrCreateCart(sessionId);

    const cartItem = await this.cartItemRepository.findByCartAndProduct(
      cart.id,
      itemId,
    );

    if (!cartItem) {
      throw new NotFoundException('Item not found in cart');
    }

    // Validate product still exists and active
    const product = await this.productService.findOne(cartItem.productId);
    if (!product || !product.active) {
      throw new BadRequestException('Product is no longer available');
    }

    // Update quantity and total
    cartItem.quantity = updateItemDto.quantity;
    cartItem.price = Number(product.price); // Update price to current
    cartItem.total = this.calculateItemTotal(
      cartItem.quantity,
      cartItem.price,
      cartItem.discount,
    );
    await this.cartItemRepository.save(cartItem);

    // Extend expiration and recalculate totals
    return await this.updateCartTotals(cart.id);
  }

  // Remove item from cart
  async removeItem(sessionId: string, itemId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(sessionId);

    await this.cartItemRepository.delete(itemId);

    // Extend expiration and recalculate totals
    return await this.updateCartTotals(cart.id);
  }

  // Clear all items from cart
  async clearCart(sessionId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(sessionId);

    await this.cartItemRepository.deleteByCartId(cart.id);

    // Recalculate totals (will be zero)
    return await this.updateCartTotals(cart.id);
  }

  // Delete cart completely
  async deleteCart(sessionId: string): Promise<void> {
    const cart = await this.cartRepository.findActiveBySessionId(sessionId);
    if (cart) {
      await this.cartRepository.delete(cart.id);
    }
  }

  // Update cart totals - SERVER-SIDE CALCULATION
  private async updateCartTotals(cartId: string): Promise<Cart> {
    const cart = await this.cartRepository.findById(cartId);
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Recalculate from database items (never trust frontend)
    let subtotal = 0;
    let discountTotal = 0;

    for (const item of cart.items) {
      subtotal += Number(item.price) * item.quantity;
      discountTotal += Number(item.discount) * item.quantity;
    }

    cart.subtotal = subtotal;
    cart.discountTotal = discountTotal;
    cart.total = subtotal - discountTotal;

    // Extend expiration on every interaction
    cart.expiresAt = this.calculateExpirationDate();

    return await this.cartRepository.save(cart);
  }

  // Calculate item total
  private calculateItemTotal(
    quantity: number,
    price: number,
    discount: number,
  ): number {
    return quantity * (price - discount);
  }

  // Calculate expiration date
  private calculateExpirationDate(): Date {
    const now = new Date();
    now.setDate(now.getDate() + this.CART_EXPIRATION_DAYS);
    return now;
  }

  // Cleanup expired carts (called by cron)
  async cleanupExpiredCarts(): Promise<number> {
    return await this.cartRepository.deleteExpired();
  }
}
