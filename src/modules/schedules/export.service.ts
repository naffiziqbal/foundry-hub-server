import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { Project } from '../projects/project.entity';
import { SchedulesService } from './schedules.service';
import { PdfService, PdfRoomGroup } from './pdf.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../../common/decorators';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    private readonly schedules: SchedulesService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Build → render → upload. Returns the CDN URL of the generated PDF.
   * If Spaces is unconfigured this throws 503 (surfaced via StorageService).
   */
  async exportSchedulePdf(
    scheduleId: string,
    user: AuthUser,
  ): Promise<{ url: string }> {
    const schedule = await this.schedules.findOne(scheduleId, user);
    const project = await this.projects.findOne({
      where: { id: schedule.projectId },
    });
    const rooms = await this.rooms.find({
      where: { projectId: schedule.projectId },
      order: { position: 'ASC' },
    });
    const roomName = new Map(rooms.map((r) => [r.id, r.name]));

    // Group schedule items by their product's room, preserving room order
    const groupsMap = new Map<string, PdfRoomGroup>();
    for (const room of rooms) {
      groupsMap.set(room.id, { roomName: room.name, rows: [] });
    }
    const ungrouped: PdfRoomGroup = { roomName: 'Unassigned', rows: [] };

    for (const item of schedule.items) {
      const p = item.product;
      const row = {
        name: p.name,
        vendor: p.vendor,
        manufacturer: p.manufacturer,
        sku: p.sku,
        price: p.price,
        currency: p.currency,
        dimensions: p.dimensions,
        approvalStatus: p.approvalStatus,
        notes: p.notes,
        imageUrl: p.images?.[0],
        specifications: p.specifications ?? [],
        quantity: item.quantity,
      };
      const group = groupsMap.get(p.roomId) ?? ungrouped;
      group.rows.push(row);
    }

    const groups = [...groupsMap.values()].filter((g) => g.rows.length > 0);
    if (ungrouped.rows.length) groups.push(ungrouped);

    const buffer = await this.pdf.render({
      projectName: project?.name ?? 'Project',
      clientName: project?.clientName,
      address: project?.address,
      scheduleName: schedule.name,
      scheduleType: schedule.type,
      generatedAt: new Date().toISOString().slice(0, 10),
      groups,
    });

    const filename = `${this.slug(project?.name)}-${this.slug(schedule.name)}.pdf`;
    const { url } = await this.storage.upload(buffer, {
      folder: 'exports',
      filename,
      contentType: 'application/pdf',
    });
    return { url };
  }

  private slug(s?: string): string {
    return (s ?? 'schedule')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }
}
