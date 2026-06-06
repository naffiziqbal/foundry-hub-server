import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { PurchaseOrderStatus } from '../../common/enums';
import { Project } from '../projects/project.entity';
import { Vendor } from '../vendors/vendor.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';

@Entity('purchase_orders')
export class PurchaseOrder extends BaseEntity {
  // Human-readable per-designer number, e.g. PO-2026-003
  @Column()
  number: string;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  // Vendor details are snapshotted so the PO survives vendor edits/deletion
  @Column()
  vendorName: string;

  @Column({ nullable: true })
  vendorEmail?: string;

  @ManyToOne(() => Vendor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor?: Vendor | null;

  @Column({ type: 'uuid', nullable: true })
  vendorId?: string | null;

  @Index()
  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'designerId' })
  designer: User;

  @Column()
  designerId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  // Vendor trade discount applied at creation time
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  discountPct?: number | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  total: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ nullable: true })
  pdfUrl?: string;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @OneToMany(() => PurchaseOrderLine, (line) => line.purchaseOrder, {
    cascade: true,
  })
  lines: PurchaseOrderLine[];
}

@Entity('purchase_order_lines')
export class PurchaseOrderLine extends BaseEntity {
  @Index()
  @ManyToOne(() => PurchaseOrder, (po) => po.lines, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column()
  purchaseOrderId: string;

  // Reference only — line data is snapshotted below
  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product | null;

  @Column({ type: 'uuid', nullable: true })
  productId?: string | null;

  @Column()
  name: string;

  @Column({ nullable: true })
  sku?: string;

  @Column({ nullable: true })
  roomName?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  unitPrice?: number | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  lineTotal: number;
}
