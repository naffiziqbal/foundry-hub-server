import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import {
  CreateProductDto,
  UpdateProductDto,
  ImportProductDto,
  DecideApprovalDto,
  ReorderProductsDto,
  MoveProductDto,
  UpdateProcurementDto,
} from './dto';

@ApiTags('products')
@ApiBearerAuth()
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // ---- listing ----
  // `?currency=EUR` adds displayPrice/displayCurrency/fxRate converted from
  // each product's stored (scraped) currency; the original price is untouched.
  @Get('rooms/:roomId/products')
  @ApiQuery({ name: 'currency', required: false })
  listForRoom(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
    @Query('currency') currency?: string,
  ) {
    return this.products.listForRoom(roomId, user, currency);
  }

  @Get('projects/:projectId/products')
  @ApiQuery({ name: 'currency', required: false })
  listForProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
    @Query('currency') currency?: string,
  ) {
    return this.products.listForProject(projectId, user, currency);
  }

  // ---- creation ----
  @Post('rooms/:roomId/products')
  @Roles(UserRole.DESIGNER)
  create(
    @Param('roomId') roomId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.createManual(roomId, dto, user);
  }

  @Post('rooms/:roomId/products/import')
  @Roles(UserRole.DESIGNER)
  importFromUrl(
    @Param('roomId') roomId: string,
    @Body() dto: ImportProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.createFromUrl(roomId, dto.url, user);
  }

  @Patch('rooms/:roomId/products/reorder')
  @Roles(UserRole.DESIGNER)
  reorder(
    @Param('roomId') roomId: string,
    @Body() dto: ReorderProductsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.reorder(roomId, dto.orderedIds, user);
  }

  // ---- single product ----
  @Get('products/:id')
  @ApiQuery({ name: 'currency', required: false })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('currency') currency?: string,
  ) {
    return this.products.findOne(id, user, currency);
  }

  @Patch('products/:id')
  @Roles(UserRole.DESIGNER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.update(id, dto, user);
  }

  @Patch('products/:id/move')
  @Roles(UserRole.DESIGNER)
  move(
    @Param('id') id: string,
    @Body() dto: MoveProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.move(id, dto, user);
  }

  @Delete('products/:id')
  @Roles(UserRole.DESIGNER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.products.remove(id, user);
    return { ok: true };
  }

  // ---- procurement ----
  @Patch('products/:id/procurement')
  @Roles(UserRole.DESIGNER)
  updateProcurement(
    @Param('id') id: string,
    @Body() dto: UpdateProcurementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.updateProcurement(id, dto, user);
  }

  @Get('projects/:projectId/procurement')
  @Roles(UserRole.DESIGNER)
  @ApiQuery({ name: 'currency', required: false })
  procurement(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
    @Query('currency') currency?: string,
  ) {
    return this.products.procurementSummary(projectId, user, currency);
  }

  // ---- approval workflow ----
  @Post('products/:id/request-approval')
  @Roles(UserRole.DESIGNER)
  requestApproval(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.products.requestApproval(id, user);
  }

  @Post('products/:id/decision')
  @Roles(UserRole.CLIENT)
  decide(
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.decide(id, dto, user);
  }
}
