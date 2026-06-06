import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { Project } from '../projects/project.entity';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Project])],
  providers: [InsightsService],
  controllers: [InsightsController],
})
export class InsightsModule {}
