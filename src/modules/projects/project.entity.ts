import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ProjectStatus } from '../../common/enums';
import { User } from '../users/user.entity';
import { Room } from '../rooms/room.entity';
import { Schedule } from '../schedules/schedule.entity';

@Entity('projects')
export class Project extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  clientName?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.PLANNING })
  status: ProjectStatus;

  @Column({ type: 'date', nullable: true })
  startDate?: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ nullable: true })
  coverImageUrl?: string;

  // Owning designer
  @Index()
  @ManyToOne(() => User, (user) => user.ownedProjects, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'designerId' })
  designer: User;

  @Column()
  designerId: string;

  // Assigned client (optional) — gives them read + approval access
  @ManyToOne(() => User, (user) => user.clientProjects, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'clientId' })
  client?: User | null;

  @Column({ type: 'uuid', nullable: true })
  clientId?: string | null;

  @OneToMany(() => Room, (room) => room.project, { cascade: true })
  rooms: Room[];

  @OneToMany(() => Schedule, (schedule) => schedule.project, { cascade: true })
  schedules: Schedule[];
}
