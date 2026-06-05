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
} from './dto';

@ApiTags('products')
@ApiBearerAuth()
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // ---- listing ----
  @Get('rooms/:roomId/products')
  listForRoom(@Param('roomId') roomId: string, @CurrentUser() user: AuthUser) {
    return this.products.listForRoom(roomId, user);
  }

  @Get('projects/:projectId/products')
  listForProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.listForProject(projectId, user);
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
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.products.findOne(id, user);
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

  // ---- approval workflow ----
  @Post('products/:id/request-approval')
  @Roles(UserRole.DESIGNER)
  requestApproval(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.products.requestApproval(id, user);
  }

  @Post('products/:id/decision')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.products.decide(id, dto, user);
  }
}
