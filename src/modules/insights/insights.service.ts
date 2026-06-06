import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { Project } from '../projects/project.entity';
import { AuthUser } from '../../common/decorators';
import { ApprovalStatus } from '../../common/enums';

export interface RoomCostStat {
  room: string; // normalized room name, e.g. "living room"
  samples: number; // how many projects contained this room with priced products
  avgTotal: number;
  minTotal: number;
  maxTotal: number;
}

export interface CostEstimate {
  projectsAnalyzed: number;
  currency: string;
  overall: { avgTotal: number; minTotal: number; maxTotal: number } | null;
  byRoom: RoomCostStat[];
  /** Present when ?rooms= was passed: a projection for a new project */
  estimate?: {
    rooms: { room: string; matched: boolean; avgTotal: number | null }[];
    total: number;
    coverage: number; // fraction of requested rooms we had data for
  };
}

/**
 * Historical cost statistics across the designer's own projects — what a
 * room or a whole project typically costs, based on selected (approved +
 * pending) product prices. Rejected products are excluded.
 */
@Injectable()
export class InsightsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  async costEstimate(user: AuthUser, rooms?: string[]): Promise<CostEstimate> {
    // Per-room-per-project totals over the designer's portfolio
    const rows: { roomName: string; projectId: string; total: string }[] =
      await this.products
        .createQueryBuilder('p')
        .innerJoin('p.room', 'room')
        .innerJoin('p.project', 'project')
        .select('LOWER(TRIM(room.name))', 'roomName')
        .addSelect('p.projectId', 'projectId')
        .addSelect('SUM(p.price)', 'total')
        .where('project.designerId = :uid', { uid: user.id })
        .andWhere('p.price IS NOT NULL')
        .andWhere('p.approvalStatus != :rejected', {
          rejected: ApprovalStatus.REJECTED,
        })
        .groupBy('LOWER(TRIM(room.name))')
        .addGroupBy('p.projectId')
        .getRawMany();

    // Aggregate per room name
    const byRoomMap = new Map<string, number[]>();
    const byProjectMap = new Map<string, number>();
    for (const row of rows) {
      const total = Number(row.total);
      if (!byRoomMap.has(row.roomName)) byRoomMap.set(row.roomName, []);
      byRoomMap.get(row.roomName)!.push(total);
      byProjectMap.set(
        row.projectId,
        (byProjectMap.get(row.projectId) ?? 0) + total,
      );
    }

    const byRoom: RoomCostStat[] = [...byRoomMap.entries()]
      .map(([room, totals]) => ({
        room,
        samples: totals.length,
        avgTotal: this.round(totals.reduce((a, b) => a + b, 0) / totals.length),
        minTotal: this.round(Math.min(...totals)),
        maxTotal: this.round(Math.max(...totals)),
      }))
      .sort((a, b) => b.avgTotal - a.avgTotal);

    const projectTotals = [...byProjectMap.values()];
    const overall = projectTotals.length
      ? {
          avgTotal: this.round(
            projectTotals.reduce((a, b) => a + b, 0) / projectTotals.length,
          ),
          minTotal: this.round(Math.min(...projectTotals)),
          maxTotal: this.round(Math.max(...projectTotals)),
        }
      : null;

    const result: CostEstimate = {
      projectsAnalyzed: projectTotals.length,
      currency: 'USD', // naive: stats assume a single working currency
      overall,
      byRoom,
    };

    // Optional projection: "what would a project with these rooms cost?"
    if (rooms?.length) {
      const estimateRooms = rooms.map((name) => {
        const key = name.trim().toLowerCase();
        const stat = byRoomMap.get(key);
        return {
          room: key,
          matched: Boolean(stat),
          avgTotal: stat
            ? this.round(stat.reduce((a, b) => a + b, 0) / stat.length)
            : null,
        };
      });
      const matched = estimateRooms.filter((r) => r.matched);
      result.estimate = {
        rooms: estimateRooms,
        total: this.round(
          matched.reduce((sum, r) => sum + (r.avgTotal ?? 0), 0),
        ),
        coverage: rooms.length ? matched.length / rooms.length : 0,
      };
    }

    return result;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
