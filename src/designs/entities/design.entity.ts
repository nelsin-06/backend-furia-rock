import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DesignStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  CONTACTED = 'contacted',
  CLOSED = 'closed',
}

@Entity('designs')
export class Design {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: DesignStatus,
    default: DesignStatus.DRAFT,
  })
  status: DesignStatus;

  @Column()
  designName: string;

  @Column()
  customerName: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  frontImageUrl: string;

  @Column({ nullable: true })
  backImageUrl: string;

  /**
   * JSON array of Cloudinary URLs for uploaded logo assets.
   * Max 30 assets per design.
   */
  @Column({ type: 'json', nullable: true })
  assets: string[];

  /**
   * JSON object containing editor state:
   * layers, positions, scale, rotation, and current view (front/back).
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
