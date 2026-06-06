import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { CurrentUser, AuthUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';

@ApiTags('insights')
@ApiBearerAuth()
@Controller('insights')
@Roles(UserRole.DESIGNER)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  /**
   * Historical cost stats. Optional ?rooms=Living Room,Kitchen returns a
   * projected total for a new project with those rooms.
   */
  @Get('cost-estimate')
  costEstimate(
    @CurrentUser() user: AuthUser,
    @Query('rooms') rooms?: string,
  ) {
    const roomList = rooms
      ? rooms.split(',').map((r) => r.trim()).filter(Boolean)
      : undefined;
    return this.insights.costEstimate(user, roomList);
  }
}
