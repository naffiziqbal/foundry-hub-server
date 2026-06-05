import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Room } from './room.entity';
import { ProjectsService } from '../projects/projects.service';
import { AuthUser } from '../../common/decorators';
import { CreateRoomDto, UpdateRoomDto } from './dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly repo: Repository<Room>,
    private readonly projects: ProjectsService,
  ) {}

  async create(
    projectId: string,
    dto: CreateRoomDto,
    user: AuthUser,
  ): Promise<Room> {
    await this.projects.assertDesigner(projectId, user);
    const count = await this.repo.count({ where: { projectId } });
    const room = this.repo.create({ ...dto, projectId, position: count });
    return this.repo.save(room);
  }

  async listForProject(projectId: string, user: AuthUser): Promise<Room[]> {
    await this.projects.assertAccess(projectId, user);
    return this.repo.find({
      where: { projectId },
      order: { position: 'ASC' },
      loadRelationIds: false,
    });
  }

  async findOne(id: string, user: AuthUser): Promise<Room> {
    const room = await this.repo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    await this.projects.assertAccess(room.projectId, user);
    return room;
  }

  async update(
    id: string,
    dto: UpdateRoomDto,
    user: AuthUser,
  ): Promise<Room> {
    const room = await this.findOne(id, user);
    await this.projects.assertDesigner(room.projectId, user);
    await this.repo.update({ id }, dto);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const room = await this.findOne(id, user);
    await this.projects.assertDesigner(room.projectId, user);
    await this.repo.delete({ id });
  }

  async reorder(
    projectId: string,
    orderedIds: string[],
    user: AuthUser,
  ): Promise<Room[]> {
    await this.projects.assertDesigner(projectId, user);
    const rooms = await this.repo.find({
      where: { id: In(orderedIds), projectId },
    });
    const byId = new Map(rooms.map((r) => [r.id, r]));
    await Promise.all(
      orderedIds.map((id, index) => {
        const room = byId.get(id);
        if (!room) return Promise.resolve();
        room.position = index;
        return this.repo.save(room);
      }),
    );
    return this.listForProject(projectId, user);
  }
}
