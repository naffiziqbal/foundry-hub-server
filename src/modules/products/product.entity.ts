import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ApprovalStatus, ImportStatus } from '../../common/enums';
import { Room } from '../rooms/room.entity';
import { Project } from '../projects/project.entity';
import { Comment } from '../comments/comment.entity';

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

  @Column({ nullable: true })
  vendor?: string;

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
