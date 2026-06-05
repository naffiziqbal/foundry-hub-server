import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { Product } from '../products/product.entity';
import { AuthUser } from '../../common/decorators';
import {
  ApprovalStatus,
  ProjectStatus,
  UserRole,
} from '../../common/enums';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly cache: RedisService,
  ) {}

  /** Cache-aside on Redis (short TTL) to keep dashboard loads well under budget. */
  summary(user: AuthUser) {
    return this.cache.remember(`dashboard:${user.id}`, 15, () =>
      this.compute(user),
    );
  }

  private async compute(user: AuthUser) {
    const isClient = user.role === UserRole.CLIENT;
    const projectWhere = isClient
      ? { clientId: user.id }
      : { designerId: user.id };

    const [projects, totalProjects] = await this.projects.findAndCount({
      where: projectWhere,
      relations: { client: true, designer: true },
      order: { updatedAt: 'DESC' },
    });

    const activeProjects = projects.filter(
      (p) =>
        p.status === ProjectStatus.IN_PROGRESS ||
        p.status === ProjectStatus.PLANNING,
    ).length;

    const projectIds = projects.map((p) => p.id);

    let pendingApprovals = 0;
    let totalProducts = 0;
    if (projectIds.length) {
      const qb = this.products
        .createQueryBuilder('p')
        .where('p.projectId IN (:...ids)', { ids: projectIds });
      totalProducts = await qb.getCount();
      pendingApprovals = await this.products
        .createQueryBuilder('p')
        .where('p.projectId IN (:...ids)', { ids: projectIds })
        .andWhere('p.approvalStatus = :status', {
          status: ApprovalStatus.PENDING,
        })
        .getCount();
    }

    return {
      stats: {
        totalProjects,
        activeProjects,
        totalProducts,
        pendingApprovals,
      },
      recentProjects: projects.slice(0, 6),
    };
  }
}
