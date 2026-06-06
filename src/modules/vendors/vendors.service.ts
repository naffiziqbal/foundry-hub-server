import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './vendor.entity';
import { Product } from '../products/product.entity';
import { AuthUser } from '../../common/decorators';
import { CreateVendorDto, UpdateVendorDto } from './dto';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly repo: Repository<Vendor>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  create(dto: CreateVendorDto, user: AuthUser): Promise<Vendor> {
    return this.repo.save(this.repo.create({ ...dto, designerId: user.id }));
  }

  /** All of the designer's vendors with a linked-product count. */
  async findAll(user: AuthUser): Promise<(Vendor & { productCount: number })[]> {
    const vendors = await this.repo.find({
      where: { designerId: user.id },
      order: { name: 'ASC' },
    });
    if (!vendors.length) return [];
    const counts: { vendorId: string; count: string }[] = await this.products
      .createQueryBuilder('p')
      .select('p.vendorId', 'vendorId')
      .addSelect('COUNT(*)', 'count')
      .where('p.vendorId IN (:...ids)', { ids: vendors.map((v) => v.id) })
      .groupBy('p.vendorId')
      .getRawMany();
    const countMap = new Map(counts.map((c) => [c.vendorId, Number(c.count)]));
    return vendors.map((v) =>
      Object.assign(v, { productCount: countMap.get(v.id) ?? 0 }),
    );
  }

  async findOne(id: string, user: AuthUser): Promise<Vendor> {
    const vendor = await this.repo.findOne({
      where: { id, designerId: user.id },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  /** Everything sourced from this vendor across all the designer's projects. */
  async productsFor(id: string, user: AuthUser): Promise<Product[]> {
    await this.findOne(id, user);
    return this.products.find({
      where: { vendorId: id },
      relations: { project: true, room: true },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateVendorDto, user: AuthUser): Promise<Vendor> {
    await this.findOne(id, user);
    await this.repo.update({ id }, dto);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    await this.findOne(id, user);
    await this.repo.delete({ id }); // products keep their vendor string; FK nulls
  }

  /**
   * Best-effort match for imports: by website hostname, then by name.
   * Returns null when nothing matches — never creates vendors implicitly.
   */
  async matchForImport(
    designerId: string,
    sourceUrl?: string,
    vendorName?: string,
  ): Promise<Vendor | null> {
    const vendors = await this.repo.find({ where: { designerId } });
    if (!vendors.length) return null;

    const host = this.hostname(sourceUrl);
    if (host) {
      const byHost = vendors.find((v) => {
        const vh = this.hostname(v.website);
        return vh && (vh === host || host.endsWith(`.${vh}`) || vh.endsWith(`.${host}`));
      });
      if (byHost) return byHost;
    }
    if (vendorName) {
      const needle = vendorName.trim().toLowerCase();
      const byName = vendors.find((v) => v.name.trim().toLowerCase() === needle);
      if (byName) return byName;
    }
    return null;
  }

  private hostname(url?: string | null): string | null {
    if (!url) return null;
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
        .replace(/^www\./, '')
        .toLowerCase();
    } catch {
      return null;
    }
  }
}
