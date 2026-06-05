import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ScheduleType } from '../../common/enums';
import { Project } from '../projects/project.entity';
import { ScheduleItem } from './schedule-item.entity';

@Entity('schedules')
export class Schedule extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'enum', enum: ScheduleType, default: ScheduleType.MATERIAL })
  type: ScheduleType;

  @Index()
  @ManyToOne(() => Project, (project) => project.schedules, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @OneToMany(() => ScheduleItem, (item) => item.schedule, { cascade: true })
  items: ScheduleItem[];
}
