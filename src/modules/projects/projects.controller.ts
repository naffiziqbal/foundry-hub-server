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
import { ProjectsService } from './projects.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { CreateProjectDto, UpdateProjectDto, AssignClientDto } from './dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projects.findAllForUser(user);
  }

  @Post()
  @Roles(UserRole.DESIGNER)
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
    return this.projects.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.DESIGNER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.update(id, dto, user);
  }

  @Patch(':id/client')
  @Roles(UserRole.DESIGNER)
  assignClient(
    @Param('id') id: string,
    @Body() dto: AssignClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.assignClient(id, dto.clientId ?? null, user);
  }

  @Delete(':id')
  @Roles(UserRole.DESIGNER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.projects.remove(id, user);
    return { ok: true };
  }
}
