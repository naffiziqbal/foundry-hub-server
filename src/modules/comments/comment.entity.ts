import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { CommentVisibility } from '../../common/enums';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

@Entity('comments')
export class Comment extends BaseEntity {
  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'enum',
    enum: CommentVisibility,
    default: CommentVisibility.INTERNAL,
  })
  visibility: CommentVisibility;

  @Index()
  @ManyToOne(() => Product, (product) => product.comments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: true })
  @JoinColumn({ name: 'authorId' })
  author?: User | null;

  @Column({ type: 'uuid', nullable: true })
  authorId?: string | null;
}
