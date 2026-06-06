import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ApprovalStatus, ImportStatus, OrderStatus } from '../../common/enums';
import { Room } from '../rooms/room.entity';
import { Project } from '../projects/project.entity';
import { Comment } from '../comments/comment.entity';
import { Vendor } from '../vendors/vendor.entity';

/** A specification line: { label: "Material", value: "Oak veneer" } */
export interface ProductSpec {
  label: string;
  value: string;
}

@Entity('products')
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Free-text vendor (scraped hostname or typed); vendorRef is the linked entity
  @Column({ nullable: true })
  vendor?: string;

  @ManyToOne(() => Vendor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendorRef?: Vendor | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  vendorId?: string | null;

  @Column({ nullable: true })
  manufacturer?: string;

  @Column({ nullable: true })
  sku?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price?: number | null;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ nullable: true })
  dimensions?: string;

  // Free-form spec rows
  @Column({ type: 'jsonb', default: () => "'[]'" })
  specifications: ProductSpec[];

  // Spaces/CDN image URLs (first is the primary)
  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  @Column({ type: 'text', nullable: true })
  sourceUrl?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  // ---- Approval workflow ----
  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  approvalStatus: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  approvalNote?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvalDecidedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvalDecidedById?: string | null;

  // ---- Procurement ----
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.NONE })
  orderStatus: OrderStatus;

  // Overrides the vendor default when set
  @Column({ type: 'int', nullable: true })
  leadTimeDays?: number | null;

  // Install/delivery deadline; with lead time this yields the order-by date
  @Column({ type: 'date', nullable: true })
  requiredByDate?: string | null;

  @Column({ type: 'date', nullable: true })
  orderedAt?: string | null;

  // ---- Import workflow ----
  @Column({ type: 'enum', enum: ImportStatus, default: ImportStatus.COMPLETED })
  importStatus: ImportStatus;

  @Column({ type: 'text', nullable: true })
  importError?: string | null;

  // ---- Relations ----
  @Index()
  @ManyToOne(() => Room, (room) => room.products, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column()
  roomId: string;

  // Denormalised project ref for fast project-scoped queries / auth checks
  @Index()
  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @OneToMany(() => Comment, (comment) => comment.product, { cascade: true })
  comments: Comment[];
}
