import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Quality } from '../../qualities/entities/quality.entity';

export type ProductVariable = {
  variantId: string;
  colorId: string;
  colorHex: string;
  colorName: string;
  images: string[];
};

// For creating products, we only need colorId and images
export type CreateProductVariable = {
  variantId?: string;
  colorId: string;
  images: string[];
};

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  @Index('idx_product_name')
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @ManyToMany(() => Category, category => category.products)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];

  @ManyToOne(() => Quality, quality => quality.products)
  @JoinColumn({ name: 'qualityId' })
  quality: Quality;

  @Column({ type: 'uuid' })
  @Index('idx_product_quality')
  qualityId: string;

  @Column({ type: 'json', nullable: true })
  variables: CreateProductVariable[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
