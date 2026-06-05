import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Schedule } from './schedule.entity';
import { Product } from '../products/product.entity';

/** Join row placing a Product into a Schedule with an explicit ordering. */
@Entity('schedule_items')
@Unique('uq_schedule_product', ['scheduleId', 'productId'])
export class ScheduleItem extends BaseEntity {
  @Index()
  @ManyToOne(() => Schedule, (schedule) => schedule.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'scheduleId' })
  schedule: Schedule;

  @Column()
  scheduleId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', nullable: false, eager: true })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;
}
