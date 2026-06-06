import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import {
  PRODUCT_IMPORT_QUEUE,
  ProductImportJob,
} from './import.constants';
import { ScraperService } from './scraper.service';
import { Product } from '../products/product.entity';
import { ImportStatus, NotificationType } from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { VendorsService } from '../vendors/vendors.service';

/**
 * BullMQ worker that scrapes a vendor URL and fills in the product record.
 * Runs out-of-band so the "Add Product" request returns immediately.
 */
@Processor(PRODUCT_IMPORT_QUEUE, { concurrency: 4 })
export class ImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly scraper: ScraperService,
    private readonly notifications: NotificationsService,
    private readonly vendors: VendorsService,
  ) {
    super();
  }

  async process(job: Job<ProductImportJob>): Promise<void> {
    const { productId, url, userId } = job.data;
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) {
      this.logger.warn(`Product ${productId} gone before import; skipping`);
      return;
    }

    await this.products.update(
      { id: productId },
      { importStatus: ImportStatus.PROCESSING },
    );

    try {
      const data = await this.scraper.scrape(url);

      // Link to a known vendor when the source matches one (by site, then name)
      const matchedVendor = await this.vendors.matchForImport(
        userId,
        url,
        data.vendor,
      );

      await this.products.update(
        { id: productId },
        {
          // Only overwrite empty fields so a user who pre-typed a name keeps it
          name: product.name && product.name !== 'Importing…' ? product.name : data.name,
          description: product.description ?? data.description,
          vendor: matchedVendor?.name ?? data.vendor ?? product.vendor,
          vendorId: product.vendorId ?? matchedVendor?.id ?? null,
          manufacturer: product.manufacturer ?? data.manufacturer,
          sku: product.sku ?? data.sku,
          price: product.price ?? data.price ?? null,
          currency: data.currency ?? product.currency,
          dimensions: product.dimensions ?? data.dimensions,
          specifications:
            product.specifications?.length
              ? product.specifications
              : data.specifications,
          images: product.images?.length ? product.images : data.images,
          importStatus: ImportStatus.COMPLETED,
          importError: null,
        },
      );

      await this.notifications.create({
        userId,
        type: NotificationType.PRODUCT_IMPORTED,
        title: 'Product imported',
        message: `"${data.name}" was imported successfully.`,
        data: { productId, projectId: product.projectId },
      });
      this.logger.log(`Imported product ${productId} from ${url}`);
    } catch (err: any) {
      const message = err?.message ?? 'Unknown scraping error';
      this.logger.warn(`Import failed for ${productId}: ${message}`);

      const lastAttempt =
        job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      if (lastAttempt) {
        await this.products.update(
          { id: productId },
          {
            importStatus: ImportStatus.FAILED,
            importError: message,
            // Give the user something editable
            name:
              product.name === 'Importing…'
                ? 'Untitled product'
                : product.name,
          },
        );
        await this.notifications.create({
          userId,
          type: NotificationType.PRODUCT_IMPORTED,
          title: 'Product import failed',
          message: `We couldn't read that URL. You can edit the product manually. (${message})`,
          data: { productId, projectId: product.projectId },
        });
      }
      // Re-throw to let BullMQ retry per attempts config
      throw err;
    }
  }
}
