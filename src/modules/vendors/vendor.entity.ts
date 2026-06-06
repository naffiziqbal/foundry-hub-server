import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';

@Entity('vendors')
export class Vendor extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  website?: string;

  @Column({ nullable: true })
  contactName?: string;

  @Column({ nullable: true })
  contactEmail?: string;

  @Column({ nullable: true })
  contactPhone?: string;

  // Trade/designer discount off retail, e.g. 15 = 15%
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  tradeDiscountPct?: number | null;

  // Typical lead time used as the default for procurement planning
  @Column({ type: 'int', nullable: true })
  defaultLeadTimeDays?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Owning designer — vendors are per-designer, like projects
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'designerId' })
  designer: User;

  @Column()
  designerId: string;
}
