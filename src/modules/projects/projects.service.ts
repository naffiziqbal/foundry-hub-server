import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { Product } from '../products/product.entity';
import { AuthUser } from '../../common/decorators';
import { ApprovalStatus, UserRole } from '../../common/enums';
import { CreateProjectDto, UpdateProjectDto } from './dto';

export interface BudgetSummary {
  budget: number | null;
  currency: string;
  /** True when products carry more than one currency — totals are then naive sums */
  multiCurrency: boolean;
  selected: number; // all products with a price
  approved: number;
  pending: number;
  rejected: number;
  remaining: number | null; // budget − selected (null when no budget set)
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async create(dto: CreateProjectDto, user: AuthUser): Promise<Project> {
    const project = this.repo.create({ ...dto, designerId: user.id });
    return this.repo.save(project);
  }

  /** Projects a user can see: owned (designer) or assigned (client). */
  async findAllForUser(user: AuthUser): Promise<Project[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.client', 'client')
      .leftJoinAndSelect('p.designer', 'designer')
      .loadRelationCountAndMap('p.roomCount', 'p.rooms')
      .orderBy('p.updatedAt', 'DESC');

    if (user.role === UserRole.CLIENT) {
      qb.where('p.clientId = :uid', { uid: user.id });
    } else {
      qb.where('p.designerId = :uid', { uid: user.id });
    }
    return qb.getMany();
  }

  /**
   * Load a project the user is allowed to access, throwing 404/403 otherwise.
   * This is the single auth gate reused across rooms/products/schedules.
   */
  async assertAccess(projectId: string, user: AuthUser): Promise<Project> {
    const project = await this.repo.findOne({
      where: { id: projectId },
      relations: { client: true, designer: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.designerId === user.id;
    const isClient = project.clientId === user.id;
    if (!isOwner && !isClient) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return project;
  }

  /** Designer-only mutating access. */
  async assertDesigner(projectId: string, user: AuthUser): Promise<Project> {
    const project = await this.assertAccess(projectId, user);
    if (project.designerId !== user.id) {
      throw new ForbiddenException('Only the project designer can do this');
    }
    return project;
  }

  async findOne(projectId: string, user: AuthUser): Promise<Project> {
    await this.assertAccess(projectId, user);
    const project = await this.repo.findOne({
      where: { id: projectId },
      relations: {
        client: true,
        designer: true,
        rooms: true,
        schedules: true,
      },
      order: { rooms: { position: 'ASC' } },
    });
    return project!;
  }

  async update(
    projectId: string,
    dto: UpdateProjectDto,
    user: AuthUser,
  ): Promise<Project> {
    await this.assertDesigner(projectId, user);
    await this.repo.update({ id: projectId }, dto);
    return this.findOne(projectId, user);
  }

  async assignClient(
    projectId: string,
    clientId: string | null,
    user: AuthUser,
  ): Promise<Project> {
    await this.assertDesigner(projectId, user);
    await this.repo.update({ id: projectId }, { clientId });
    return this.findOne(projectId, user);
  }

  async remove(projectId: string, user: AuthUser): Promise<void> {
    await this.assertDesigner(projectId, user);
    await this.repo.delete({ id: projectId });
  }

  /** Budget vs. running selection totals, broken down by approval status. */
  async budgetSummary(projectId: string, user: AuthUser): Promise<BudgetSummary> {
    const project = await this.assertAccess(projectId, user);
    const rows: { status: ApprovalStatus; currency: string; total: string }[] =
      await this.products
        .createQueryBuilder('p')
        .select('p.approvalStatus', 'status')
        .addSelect('p.currency', 'currency')
        .addSelect('SUM(p.price)', 'total')
        .where('p.projectId = :projectId', { projectId })
        .andWhere('p.price IS NOT NULL')
        .groupBy('p.approvalStatus')
        .addGroupBy('p.currency')
        .getRawMany();

    const currencies = new Set(rows.map((r) => r.currency));
    const byStatus = (status: ApprovalStatus) =>
      rows
        .filter((r) => r.status === status)
        .reduce((sum, r) => sum + Number(r.total), 0);

    const approved = byStatus(ApprovalStatus.APPROVED);
    const pending = byStatus(ApprovalStatus.PENDING);
    const rejected = byStatus(ApprovalStatus.REJECTED);
    const selected = approved + pending; // rejected items won't be bought
    const budget = project.budget != null ? Number(project.budget) : null;

    return {
      budget,
      currency: rows[0]?.currency ?? 'USD',
      multiCurrency: currencies.size > 1,
      selected,
      approved,
      pending,
      rejected,
      remaining: budget != null ? budget - selected : null,
    };
  }
}
