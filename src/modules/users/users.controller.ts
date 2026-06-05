import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { UpdateProfileDto } from './dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser('id') id: string) {
    return this.sanitize(await this.users.findById(id));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.sanitize(await this.users.update(id, dto));
  }

  /** Designers fetch the list of client accounts to assign to projects. */
  @Get('clients')
  @Roles(UserRole.DESIGNER)
  async clients() {
    return (await this.users.listClients()).map((u) => this.sanitize(u));
  }

  private sanitize(u: any) {
    const { passwordHash, resetTokenHash, resetTokenExpires, ...rest } = u;
    return rest;
  }
}
