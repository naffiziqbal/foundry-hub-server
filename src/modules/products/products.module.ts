import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Room } from '../rooms/room.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProjectsModule } from '../projects/projects.module';
import { ImportModule } from '../import/import.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Room]),
    ProjectsModule,
    ImportModule,
    NotificationsModule,
  ],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
