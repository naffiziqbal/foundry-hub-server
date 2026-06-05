import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Schedule } from './schedule.entity';
import { ScheduleItem } from './schedule-item.entity';
import { Product } from '../products/product.entity';
import { ProjectsService } from '../projects/projects.service';
import { AuthUser } from '../../common/decorators';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  AddScheduleItemDto,
  UpdateScheduleItemDto,
} from './dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly repo: Repository<Schedule>,
    @InjectRepository(ScheduleItem)
    private readonly items: Repository<ScheduleItem>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly projects: ProjectsService,
  ) {}

  async create(
    projectId: string,
    dto: CreateScheduleDto,
    user: AuthUser,
  ): Promise<Schedule> {
    await this.projects.assertDesigner(projectId, user);
    const schedule = this.repo.create({ ...dto, projectId });
    return this.repo.save(schedule);
  }

  async listForProject(projectId: string, user: AuthUser): Promise<Schedule[]> {
    await this.projects.assertAccess(projectId, user);
    return this.repo
      .createQueryBuilder('s')
      .where('s.projectId = :projectId', { projectId })
      .loadRelationCountAndMap('s.itemCount', 's.items')
      .orderBy('s.createdAt', 'ASC')
      .getMany();
  }

  async findOne(id: string, user: AuthUser): Promise<Schedule> {
    const schedule = await this.repo.findOne({
      where: { id },
      relations: { items: { product: true } },
      order: { items: { position: 'ASC' } },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.projects.assertAccess(schedule.projectId, user);
    return schedule;
  }

  async update(
    id: string,
    dto: UpdateScheduleDto,
    user: AuthUser,
  ): Promise<Schedule> {
    const schedule = await this.findOne(id, user);
    await this.projects.assertDesigner(schedule.projectId, user);
    await this.repo.update({ id }, dto);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const schedule = await this.findOne(id, user);
    await this.projects.assertDesigner(schedule.projectId, user);
    await this.repo.delete({ id });
  }

  async addItem(
    scheduleId: string,
    dto: AddScheduleItemDto,
    user: AuthUser,
  ): Promise<Schedule> {
    const schedule = await this.findOne(scheduleId, user);
    await this.projects.assertDesigner(schedule.projectId, user);

    const product = await this.products.findOne({
      where: { id: dto.productId },
    });
    if (!product || product.projectId !== schedule.projectId) {
      throw new BadRequestException('Product is not part of this project');
    }
    const existing = await this.items.findOne({
      where: { scheduleId, productId: dto.productId },
    });
    if (existing) throw new BadRequestException('Product already on this schedule');

    const count = await this.items.count({ where: { scheduleId } });
    const item = this.items.create({
      scheduleId,
      productId: dto.productId,
      quantity: dto.quantity ?? 1,
      position: count,
    });
    await this.items.save(item);
    return this.findOne(scheduleId, user);
  }

  async updateItem(
    itemId: string,
    dto: UpdateScheduleItemDto,
    user: AuthUser,
  ): Promise<Schedule> {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Schedule item not found');
    const schedule = await this.findOne(item.scheduleId, user);
    await this.projects.assertDesigner(schedule.projectId, user);
    await this.items.update({ id: itemId }, dto);
    return this.findOne(item.scheduleId, user);
  }

  async removeItem(itemId: string, user: AuthUser): Promise<Schedule> {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Schedule item not found');
    const schedule = await this.findOne(item.scheduleId, user);
    await this.projects.assertDesigner(schedule.projectId, user);
    await this.items.delete({ id: itemId });
    return this.findOne(item.scheduleId, user);
  }

  async reorderItems(
    scheduleId: string,
    orderedIds: string[],
    user: AuthUser,
  ): Promise<Schedule> {
    const schedule = await this.findOne(scheduleId, user);
    await this.projects.assertDesigner(schedule.projectId, user);
    const items = await this.items.find({
      where: { id: In(orderedIds), scheduleId },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    await Promise.all(
      orderedIds.map((id, index) => {
        const item = byId.get(id);
        if (!item) return Promise.resolve();
        item.position = index;
        return this.items.save(item);
      }),
    );
    return this.findOne(scheduleId, user);
  }
}
