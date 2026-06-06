import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './schedule.entity';
import { ScheduleItem } from './schedule-item.entity';
import { Product } from '../products/product.entity';
import { Room } from '../rooms/room.entity';
import { Project } from '../projects/project.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { ExportService } from './export.service';
import { PdfService } from './pdf.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Schedule,
      ScheduleItem,
      Product,
      Room,
      Project,
    ]),
    ProjectsModule,
  ],
  providers: [SchedulesService, ExportService, PdfService],
  controllers: [SchedulesController],
  exports: [SchedulesService, PdfService],
})
export class SchedulesModule {}
