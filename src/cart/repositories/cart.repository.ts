import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cart, CartStatus } from '../entities/cart.entity';

@Injectable()
export class CartRepository {
  constructor(
    @InjectRepository(Cart)
    private readonly repository: Repository<Cart>,
  ) {}

  // Find active cart by sessionId
  async findActiveBySessionId(sessionId: string): Promise<Cart | null> {
    return this.repository.findOne({
      where: {
        sessionId,
        status: CartStatus.ACTIVE,
      },
      relations: ['items'],
    });
  }

  // Find cart by ID
  async findById(id: string): Promise<Cart | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  // Create new cart
  create(data: Partial<Cart>): Cart {
    return this.repository.create(data);
  }

  // Save cart
  async save(cart: Cart): Promise<Cart> {
    return this.repository.save(cart);
  }

  // Delete expired carts
  async deleteExpired(): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThan(new Date()),
      status: CartStatus.ACTIVE,
    });
    return result.affected || 0;
  }

  // Delete cart
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  // Find all active carts
  async findAll(): Promise<Cart[]> {
    return this.repository.find({
      where: { status: CartStatus.ACTIVE },
      relations: ['items'],
    });
  }
}
