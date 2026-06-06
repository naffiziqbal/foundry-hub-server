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
import { VendorsService } from './vendors.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { CreateVendorDto, UpdateVendorDto } from './dto';

@ApiTags('vendors')
@ApiBearerAuth()
@Controller('vendors')
@Roles(UserRole.DESIGNER)
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.vendors.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateVendorDto, @CurrentUser() user: AuthUser) {
    return this.vendors.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.vendors.findOne(id, user);
  }

  @Get(':id/products')
  products(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.vendors.productsFor(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendors.update(id, dto, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.vendors.remove(id, user);
    return { ok: true };
  }
}
