import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index('idx_category_name')
  name: string;

  @Column({ type: 'boolean', default: false })
  @Index('idx_category_default')
  default: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // Relación padre-hijo
  @ManyToOne(() => Category, category => category.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentId' })
  parent: Category;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_category_parent')
  parentId: string | null;

  @OneToMany(() => Category, category => category.parent)
  children: Category[];

  @ManyToMany(() => Product, product => product.categories)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}