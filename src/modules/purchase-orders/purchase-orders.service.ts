import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PurchaseOrder, PurchaseOrderLine } from './purchase-order.entity';
import { Product } from '../products/product.entity';
import { ProjectsService } from '../projects/projects.service';
import { VendorsService } from '../vendors/vendors.service';
import { PdfService } from '../schedules/pdf.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../../common/decorators';
import {
  ApprovalStatus,
  OrderStatus,
  PurchaseOrderStatus,
} from '../../common/enums';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderStatusDto } from './dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly repo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderLine)
    private readonly lines: Repository<PurchaseOrderLine>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly projects: ProjectsService,
    private readonly vendors: VendorsService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Draft a PO from every approved, to-order product of the given vendor in
   * the project. Lines are snapshots — later product edits don't alter the PO.
   */
  async create(
    projectId: string,
    dto: CreatePurchaseOrderDto,
    user: AuthUser,
  ): Promise<PurchaseOrder> {
    await this.projects.assertDesigner(projectId, user);
    const vendor = await this.vendors.findOne(dto.vendorId, user);

    const candidates = await this.products.find({
      where: {
        projectId,
        vendorId: vendor.id,
        approvalStatus: ApprovalStatus.APPROVED,
        orderStatus: OrderStatus.TO_ORDER,
      },
      relations: { room: true },
    });
    if (!candidates.length) {
      throw new BadRequestException(
        `No approved "to order" products from ${vendor.name} in this project`,
      );
    }

    // Skip products already on a live PO (drafts included) — otherwise two
    // drafts for the same vendor would double-order everything.
    const alreadyOnPo: { productId: string }[] = await this.lines
      .createQueryBuilder('l')
      .innerJoin(PurchaseOrder, 'po', 'po.id = l."purchaseOrderId"')
      .where('l."productId" IN (:...ids)', {
        ids: candidates.map((p) => p.id),
      })
      .andWhere('po.status != :cancelled', {
        cancelled: PurchaseOrderStatus.CANCELLED,
      })
      .select('l."productId"', 'productId')
      .getRawMany();
    const taken = new Set(alreadyOnPo.map((r) => r.productId));
    const products = candidates.filter((p) => !taken.has(p.id));
    if (!products.length) {
      throw new BadRequestException(
        `All "to order" products from ${vendor.name} are already on a purchase order`,
      );
    }

    const discountPct =
      vendor.tradeDiscountPct != null ? Number(vendor.tradeDiscountPct) : null;
    const subtotal = products.reduce(
      (sum, p) => sum + (p.price != null ? Number(p.price) : 0),
      0,
    );
    const total = discountPct ? subtotal * (1 - discountPct / 100) : subtotal;

    const po = await this.repo.save(
      this.repo.create({
        number: await this.nextNumber(user.id),
        vendorName: vendor.name,
        vendorEmail: vendor.contactEmail,
        vendorId: vendor.id,
        projectId,
        designerId: user.id,
        subtotal: this.round(subtotal),
        discountPct,
        total: this.round(total),
        currency: products[0].currency ?? 'USD',
        notes: dto.notes,
      }),
    );

    await this.lines.save(
      products.map((p) =>
        this.lines.create({
          purchaseOrderId: po.id,
          productId: p.id,
          name: p.name,
          sku: p.sku,
          roomName: p.room?.name,
          unitPrice: p.price != null ? Number(p.price) : null,
          quantity: 1,
          lineTotal: p.price != null ? Number(p.price) : 0,
        }),
      ),
    );

    return this.findOne(po.id, user);
  }

  async findAllForProject(
    projectId: string,
    user: AuthUser,
  ): Promise<PurchaseOrder[]> {
    await this.projects.assertDesigner(projectId, user);
    return this.repo.find({
      where: { projectId },
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: AuthUser): Promise<PurchaseOrder> {
    const po = await this.repo.findOne({
      where: { id, designerId: user.id },
      relations: { lines: true, project: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  /**
   * Status transitions. Marking a PO "sent" moves its products to ORDERED
   * and stamps their order date; cancelling moves them back to TO_ORDER.
   */
  async updateStatus(
    id: string,
    dto: UpdatePurchaseOrderStatusDto,
    user: AuthUser,
  ): Promise<PurchaseOrder> {
    const po = await this.findOne(id, user);
    if (po.status === dto.status) return po;

    const patch: Partial<PurchaseOrder> = { status: dto.status };
    if (dto.status === PurchaseOrderStatus.SENT && !po.sentAt) {
      patch.sentAt = new Date();
    }
    await this.repo.update({ id }, patch);

    const productIds = po.lines
      .map((l) => l.productId)
      .filter((pid): pid is string => Boolean(pid));
    if (productIds.length) {
      if (dto.status === PurchaseOrderStatus.SENT) {
        await this.products.update(
          { id: In(productIds) },
          {
            orderStatus: OrderStatus.ORDERED,
            orderedAt: new Date().toISOString().slice(0, 10),
          },
        );
      } else if (dto.status === PurchaseOrderStatus.CANCELLED) {
        await this.products.update(
          { id: In(productIds), orderStatus: OrderStatus.ORDERED },
          { orderStatus: OrderStatus.TO_ORDER, orderedAt: null },
        );
      }
    }
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const po = await this.findOne(id, user);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft POs can be deleted');
    }
    await this.repo.delete({ id });
  }

  /** Render the PO as a PDF, upload to Spaces, persist + return the URL. */
  async exportPdf(id: string, user: AuthUser): Promise<{ url: string }> {
    const po = await this.findOne(id, user);
    const buffer = await this.pdf.renderPurchaseOrder({
      number: po.number,
      status: po.status,
      vendorName: po.vendorName,
      vendorEmail: po.vendorEmail,
      projectName: po.project?.name ?? 'Project',
      projectAddress: po.project?.address,
      generatedAt: new Date().toISOString().slice(0, 10),
      currency: po.currency,
      subtotal: Number(po.subtotal),
      discountPct: po.discountPct != null ? Number(po.discountPct) : null,
      total: Number(po.total),
      notes: po.notes,
      lines: po.lines.map((l) => ({
        name: l.name,
        sku: l.sku,
        roomName: l.roomName,
        unitPrice: l.unitPrice != null ? Number(l.unitPrice) : null,
        quantity: l.quantity,
        lineTotal: Number(l.lineTotal),
      })),
    });
    const { url } = await this.storage.upload(buffer, {
      folder: 'exports',
      filename: `${po.number.toLowerCase()}-${po.vendorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      contentType: 'application/pdf',
    });
    await this.repo.update({ id }, { pdfUrl: url });
    return { url };
  }

  private async nextNumber(designerId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo.count({ where: { designerId } });
    return `PO-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
