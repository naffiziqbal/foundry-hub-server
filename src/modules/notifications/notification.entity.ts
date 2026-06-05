import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { NotificationType } from '../../common/enums';
import { User } from '../users/user.entity';

@Entity('notifications')
export class Notification extends BaseEntity {
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ default: false })
  read: boolean;

  // Arbitrary payload (e.g. { projectId, productId }) for client-side routing
  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, any>;
}
