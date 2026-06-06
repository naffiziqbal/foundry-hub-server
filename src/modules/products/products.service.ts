import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './product.entity';
import { Room } from '../rooms/room.entity';
import { ProjectsService } from '../projects/projects.service';
import { ImportService } from '../import/import.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../../common/decorators';
import {
  ApprovalStatus,
  ImportStatus,
  NotificationType,
  OrderStatus,
  UserRole,
} from '../../common/enums';
import {
  CreateProductDto,
  UpdateProductDto,
  DecideApprovalDto,
  MoveProductDto,
  UpdateProcurementDto,
} from './dto';

export interface ProcurementItem {
  id: string;
  name: string;
  roomName: string;
  vendor?: string;
  vendorId?: string | null;
  price?: number | null;
  currency: string;
  imageUrl?: string;
  orderStatus: OrderStatus;
  leadTimeDays: number | null; // effective: product override ?? vendor default
  requiredByDate: string | null;
  orderByDate: string | null; // requiredBy − leadTime
  orderedAt: string | null;
  urgency: 'overdue' | 'urgent' | 'ok'; // for not-yet-ordered items
}

export interface ProcurementSummary {
  counts: Record<string, number>;
  items: ProcurementItem[];
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    private readonly projects: ProjectsService,
    private readonly importService: ImportService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getRoomOrThrow(roomId: string): Promise<Room> {
    const room = await this.rooms.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async createManual(
    roomId: string,
    dto: CreateProductDto,
    user: AuthUser,
  ): Promise<Product> {
    const room = await this.getRoomOrThrow(roomId);
    await this.projects.assertDesigner(room.projectId, user);
    const count = await this.repo.count({ where: { roomId } });

    const product = this.repo.create({
      ...dto,
      specifications: dto.specifications ?? [],
      images: dto.images ?? [],
      price: dto.price ?? null,
      roomId,
      projectId: room.projectId,
      position: count,
      importStatus: ImportStatus.COMPLETED,
    });
    return this.repo.save(product);
  }

  /** Create a placeholder and kick off async scraping via BullMQ. */
  async createFromUrl(
    roomId: string,
    url: string,
    user: AuthUser,
  ): Promise<Product> {
    const room = await this.getRoomOrThrow(roomId);
    await this.projects.assertDesigner(room.projectId, user);
    const count = await this.repo.count({ where: { roomId } });

    const placeholder = this.repo.create({
      name: 'Importing…',
      sourceUrl: url,
      roomId,
      projectId: room.projectId,
      position: count,
      specifications: [],
      images: [],
      importStatus: ImportStatus.PENDING,
    });
    const saved = await this.repo.save(placeholder);

    await this.importService.enqueue({
      productId: saved.id,
      url,
      userId: user.id,
    });
    return saved;
  }

  async listForRoom(roomId: string, user: AuthUser): Promise<Product[]> {
    const room = await this.getRoomOrThrow(roomId);
    await this.projects.assertAccess(room.projectId, user);
    return this.repo.find({
      where: { roomId },
      order: { position: 'ASC' },
    });
  }

  async listForProject(projectId: string, user: AuthUser): Promise<Product[]> {
    await this.projects.assertAccess(projectId, user);
    return this.repo.find({
      where: { projectId },
      order: { position: 'ASC' },
    });
  }

  async findOne(id: string, user: AuthUser): Promise<Product> {
    const product = await this.repo.findOne({
      where: { id },
      relations: { comments: true, room: true },
      order: { comments: { createdAt: 'ASC' } },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.projects.assertAccess(product.projectId, user);
    return product;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    user: AuthUser,
  ): Promise<Product> {
    const product = await this.findOne(id, user);
    await this.projects.assertDesigner(product.projectId, user);
    Object.assign(product, dto);
    if (dto.price === undefined) product.price = product.price ?? null;
    await this.repo.save(product);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const product = await this.findOne(id, user);
    await this.projects.assertDesigner(product.projectId, user);
    await this.repo.delete({ id });
  }

  async move(id: string, dto: MoveProductDto, user: AuthUser): Promise<Product> {
    const product = await this.findOne(id, user);
    await this.projects.assertDesigner(product.projectId, user);
    const targetRoom = await this.getRoomOrThrow(dto.roomId);
    if (targetRoom.projectId !== product.projectId) {
      throw new BadRequestException('Cannot move a product across projects');
    }
    product.roomId = dto.roomId;
    if (dto.position != null) product.position = dto.position;
    await this.repo.save(product);
    return this.findOne(id, user);
  }

  async reorder(
    roomId: string,
    orderedIds: string[],
    user: AuthUser,
  ): Promise<Product[]> {
    const room = await this.getRoomOrThrow(roomId);
    await this.projects.assertDesigner(room.projectId, user);
    const products = await this.repo.find({
      where: { id: In(orderedIds), roomId },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    await Promise.all(
      orderedIds.map((pid, index) => {
        const p = byId.get(pid);
        if (!p) return Promise.resolve();
        p.position = index;
        return this.repo.save(p);
      }),
    );
    return this.listForRoom(roomId, user);
  }

  // ---- Approval workflow ----

  /** Designer asks the assigned client to review the product. */
  async requestApproval(id: string, user: AuthUser): Promise<Product> {
    const product = await this.findOne(id, user);
    const project = await this.projects.assertDesigner(product.projectId, user);

    product.approvalStatus = ApprovalStatus.PENDING;
    product.approvalNote = null;
    product.approvalDecidedAt = null;
    product.approvalDecidedById = null;
    await this.repo.save(product);

    if (project.clientId) {
      await this.notifications.create({
        userId: project.clientId,
        type: NotificationType.APPROVAL_REQUEST,
        title: 'Approval requested',
        message: `"${product.name}" is ready for your review in ${project.name}.`,
        data: { productId: product.id, projectId: project.id },
        email: true,
      });
    }
    return this.findOne(id, user);
  }

  /** Designer updates a product's procurement state (status / lead time / deadline). */
  async updateProcurement(
    id: string,
    dto: UpdateProcurementDto,
    user: AuthUser,
  ): Promise<Product> {
    const product = await this.findOne(id, user);
    await this.projects.assertDesigner(product.projectId, user);

    if (
      dto.orderStatus &&
      dto.orderStatus !== OrderStatus.NONE &&
      product.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Only approved products can enter procurement',
      );
    }

    const patch: Partial<Product> = {};
    if (dto.orderStatus !== undefined) {
      patch.orderStatus = dto.orderStatus;
      // Stamp the order date the first time it transitions to ordered
      if (dto.orderStatus === OrderStatus.ORDERED && !product.orderedAt) {
        patch.orderedAt = new Date().toISOString().slice(0, 10);
      }
    }
    if (dto.leadTimeDays !== undefined) patch.leadTimeDays = dto.leadTimeDays;
    if (dto.requiredByDate !== undefined)
      patch.requiredByDate = dto.requiredByDate;

    await this.repo.update({ id }, patch);
    return this.findOne(id, user);
  }

  /**
   * Procurement board for a project: approved products with their order
   * lifecycle, effective lead times and computed order-by dates.
   */
  async procurementSummary(
    projectId: string,
    user: AuthUser,
  ): Promise<ProcurementSummary> {
    await this.projects.assertDesigner(projectId, user);
    const products = await this.repo.find({
      where: { projectId, approvalStatus: ApprovalStatus.APPROVED },
      relations: { vendorRef: true, room: true },
      order: { createdAt: 'ASC' },
    });

    const today = new Date().toISOString().slice(0, 10);
    const urgentCutoff = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .slice(0, 10);

    const items: ProcurementItem[] = products.map((p) => {
      const leadTimeDays =
        p.leadTimeDays ?? p.vendorRef?.defaultLeadTimeDays ?? null;
      let orderByDate: string | null = null;
      if (p.requiredByDate) {
        const required = new Date(p.requiredByDate);
        required.setDate(required.getDate() - (leadTimeDays ?? 0));
        orderByDate = required.toISOString().slice(0, 10);
      }
      const awaitingOrder =
        p.orderStatus === OrderStatus.NONE ||
        p.orderStatus === OrderStatus.TO_ORDER;
      const urgency: ProcurementItem['urgency'] =
        awaitingOrder && orderByDate
          ? orderByDate < today
            ? 'overdue'
            : orderByDate <= urgentCutoff
              ? 'urgent'
              : 'ok'
          : 'ok';
      return {
        id: p.id,
        name: p.name,
        roomName: p.room?.name ?? '—',
        vendor: p.vendor,
        vendorId: p.vendorId,
        price: p.price != null ? Number(p.price) : null,
        currency: p.currency,
        imageUrl: p.images?.[0],
        orderStatus: p.orderStatus,
        leadTimeDays,
        requiredByDate: p.requiredByDate ?? null,
        orderByDate,
        orderedAt: p.orderedAt ?? null,
        urgency,
      };
    });

    const counts: Record<string, number> = {};
    for (const status of Object.values(OrderStatus)) counts[status] = 0;
    for (const item of items) counts[item.orderStatus]++;

    return { counts, items };
  }

  /** Assigned client records an approve/reject decision (client-only route). */
  async decide(
    id: string,
    dto: DecideApprovalDto,
    user: AuthUser,
  ): Promise<Product> {
    const product = await this.findOne(id, user);
    const project = await this.projects.assertAccess(product.projectId, user);

    if (dto.status === ApprovalStatus.PENDING) {
      throw new BadRequestException('Decision must be approved or rejected');
    }
    // Only the client assigned to the project may decide.
    if (project.clientId !== user.id) {
      throw new ForbiddenException('Not your project to approve');
    }

    product.approvalStatus = dto.status;
    product.approvalNote = dto.note ?? null;
    product.approvalDecidedAt = new Date();
    product.approvalDecidedById = user.id;
    await this.repo.save(product);

    // Notify the designer of the decision (unless they made it themselves)
    if (project.designerId !== user.id) {
      await this.notifications.create({
        userId: project.designerId,
        type: NotificationType.APPROVAL_DECISION,
        title: `Product ${dto.status}`,
        message: `${user.name} ${dto.status} "${product.name}".`,
        data: { productId: product.id, projectId: project.id },
        email: true,
      });
    }
    return this.findOne(id, user);
  }
}
