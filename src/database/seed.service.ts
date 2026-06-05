import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppConfig } from '../config/configuration';
import { User } from '../modules/users/user.entity';
import { Project } from '../modules/projects/project.entity';
import { Room } from '../modules/rooms/room.entity';
import { Schedule } from '../modules/schedules/schedule.entity';
import {
  ProjectStatus,
  ScheduleType,
  UserRole,
} from '../common/enums';

/**
 * Seeds a demo designer + client (and a sample project) on first boot so the
 * app is immediately explorable. Idempotent — skips if the demo user exists.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(Schedule)
    private readonly schedules: Repository<Schedule>,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get('seedOnBoot', { infer: true })) return;
    try {
      await this.seed();
    } catch (err) {
      this.logger.warn(`Seed skipped: ${err}`);
    }
  }

  async seed() {
    const existing = await this.users.findOne({
      where: { email: 'designer@foundry.dev' },
    });
    if (existing) {
      this.logger.log('Seed data already present — skipping.');
      return;
    }

    const passwordHash = await bcrypt.hash('Password1!', 12);

    const designer = await this.users.save(
      this.users.create({
        email: 'designer@foundry.dev',
        passwordHash,
        name: 'Avery Designer',
        company: 'Foundry Studio',
        role: UserRole.DESIGNER,
      }),
    );
    const client = await this.users.save(
      this.users.create({
        email: 'client@foundry.dev',
        passwordHash,
        name: 'Jordan Client',
        role: UserRole.CLIENT,
      }),
    );

    const project = await this.projects.save(
      this.projects.create({
        name: 'Maple Street Residence',
        clientName: 'Jordan Client',
        address: '14 Maple Street, Brooklyn, NY',
        status: ProjectStatus.IN_PROGRESS,
        notes: 'Full-home renovation. Warm, modern, natural materials.',
        designerId: designer.id,
        clientId: client.id,
      }),
    );

    const roomNames = ['Living Room', 'Kitchen', 'Primary Bedroom'];
    await this.rooms.save(
      roomNames.map((name, i) =>
        this.rooms.create({ name, projectId: project.id, position: i }),
      ),
    );

    await this.schedules.save([
      this.schedules.create({
        name: 'Material Schedule',
        type: ScheduleType.MATERIAL,
        projectId: project.id,
      }),
      this.schedules.create({
        name: 'Furniture Schedule',
        type: ScheduleType.FURNITURE,
        projectId: project.id,
      }),
    ]);

    this.logger.log(
      '✅ Seeded demo accounts — designer@foundry.dev / client@foundry.dev (Password1!)',
    );
  }
}
