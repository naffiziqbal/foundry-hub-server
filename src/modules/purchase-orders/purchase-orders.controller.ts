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
import { PurchaseOrdersService } from './purchase-orders.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderStatusDto } from './dto';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller()
@Roles(UserRole.DESIGNER)
export class PurchaseOrdersController {
  constructor(private readonly pos: PurchaseOrdersService) {}

  @Post('projects/:projectId/purchase-orders')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pos.create(projectId, dto, user);
  }

  @Get('projects/:projectId/purchase-orders')
  list(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.pos.findAllForProject(projectId, user);
  }

  @Get('purchase-orders/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pos.findOne(id, user);
  }

  @Patch('purchase-orders/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pos.updateStatus(id, dto, user);
  }

  @Post('purchase-orders/:id/export')
  export(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pos.exportPdf(id, user);
  }

  @Delete('purchase-orders/:id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.pos.remove(id, user);
    return { ok: true };
  }
}
