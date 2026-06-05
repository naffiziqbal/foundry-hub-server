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
  UserRole,
} from '../../common/enums';
import {
  CreateProductDto,
  UpdateProductDto,
  DecideApprovalDto,
  MoveProductDto,
} from './dto';

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

  /** Client (or owning designer) records an approve/reject decision. */
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
    // Clients may only decide on projects assigned to them; designers may too.
    if (
      user.role === UserRole.CLIENT &&
      project.clientId !== user.id
    ) {
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
