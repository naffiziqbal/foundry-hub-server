import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder, PurchaseOrderLine } from './purchase-order.entity';
import { Product } from '../products/product.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { ProjectsModule } from '../projects/projects.module';
import { VendorsModule } from '../vendors/vendors.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderLine, Product]),
    ProjectsModule,
    VendorsModule,
    SchedulesModule,
  ],
  providers: [PurchaseOrdersService],
  controllers: [PurchaseOrdersController],
})
export class PurchaseOrdersModule {}
