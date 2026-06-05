import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Project } from '../projects/project.entity';
import { Product } from '../products/product.entity';

@Entity('rooms')
export class Room extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Index()
  @ManyToOne(() => Project, (project) => project.rooms, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @OneToMany(() => Product, (product) => product.room, { cascade: true })
  products: Product[];
}
