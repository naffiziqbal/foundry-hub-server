import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { UserRole } from '../../common/enums';
import { Project } from '../projects/project.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  company?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.DESIGNER })
  role: UserRole;

  // Password-reset support (hashed token + expiry)
  @Column({ type: 'varchar', nullable: true, select: false })
  resetTokenHash?: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  resetTokenExpires?: Date | null;

  // Projects this user owns (designers)
  @OneToMany(() => Project, (project) => project.designer)
  ownedProjects: Project[];

  // Projects this user is the assigned client of
  @OneToMany(() => Project, (project) => project.client)
  clientProjects: Project[];
}
