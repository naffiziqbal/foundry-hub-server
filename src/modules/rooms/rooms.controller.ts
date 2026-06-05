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
import { RoomsService } from './rooms.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { CreateRoomDto, UpdateRoomDto, ReorderRoomsDto } from './dto';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('projects/:projectId/rooms')
  list(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.rooms.listForProject(projectId, user);
  }

  @Post('projects/:projectId/rooms')
  @Roles(UserRole.DESIGNER)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.create(projectId, dto, user);
  }

  @Patch('projects/:projectId/rooms/reorder')
  @Roles(UserRole.DESIGNER)
  reorder(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderRoomsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.reorder(projectId, dto.orderedIds, user);
  }

  @Get('rooms/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rooms.findOne(id, user);
  }

  @Patch('rooms/:id')
  @Roles(UserRole.DESIGNER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.update(id, dto, user);
  }

  @Delete('rooms/:id')
  @Roles(UserRole.DESIGNER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.rooms.remove(id, user);
    return { ok: true };
  }
}
