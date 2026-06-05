import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { ExportService } from './export.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  AddScheduleItemDto,
  UpdateScheduleItemDto,
  ReorderItemsDto,
} from './dto';

@ApiTags('schedules')
@ApiBearerAuth()
@Controller()
export class SchedulesController {
  constructor(
    private readonly schedules: SchedulesService,
    private readonly exporter: ExportService,
  ) {}

  @Get('projects/:projectId/schedules')
  list(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.schedules.listForProject(projectId, user);
  }

  @Post('projects/:projectId/schedules')
  @Roles(UserRole.DESIGNER)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedules.create(projectId, dto, user);
  }

  @Get('schedules/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.schedules.findOne(id, user);
  }

  @Patch('schedules/:id')
  @Roles(UserRole.DESIGNER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedules.update(id, dto, user);
  }

  @Delete('schedules/:id')
  @Roles(UserRole.DESIGNER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.schedules.remove(id, user);
    return { ok: true };
  }

  // ---- items ----
  @Post('schedules/:id/items')
  @Roles(UserRole.DESIGNER)
  addItem(
    @Param('id') id: string,
    @Body() dto: AddScheduleItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedules.addItem(id, dto, user);
  }

  @Patch('schedules/:id/items/reorder')
  @Roles(UserRole.DESIGNER)
  reorderItems(
    @Param('id') id: string,
    @Body() dto: ReorderItemsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedules.reorderItems(id, dto.orderedIds, user);
  }

  @Patch('schedule-items/:itemId')
  @Roles(UserRole.DESIGNER)
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateScheduleItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedules.updateItem(itemId, dto, user);
  }

  @Delete('schedule-items/:itemId')
  @Roles(UserRole.DESIGNER)
  removeItem(@Param('itemId') itemId: string, @CurrentUser() user: AuthUser) {
    return this.schedules.removeItem(itemId, user);
  }

  // ---- export ----
  @Post('schedules/:id/export')
  @Roles(UserRole.DESIGNER)
  exportPdf(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.exporter.exportSchedulePdf(id, user);
  }
}
