import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PRODUCT_IMPORT_QUEUE } from './import.constants';
import { ImportService } from './import.service';
import { ImportProcessor } from './import.processor';
import { ScraperService } from './scraper.service';
import { Product } from '../products/product.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: PRODUCT_IMPORT_QUEUE }),
    TypeOrmModule.forFeature([Product]),
    NotificationsModule,
    VendorsModule,
  ],
  providers: [ImportService, ImportProcessor, ScraperService],
  exports: [ImportService, ScraperService],
})
export class ImportModule {}
