import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.list(userId, unread === 'true');
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('id') userId: string) {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Post(':id/read')
  async read(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.notifications.markRead(id, userId);
    return { ok: true };
  }

  @Post('read-all')
  async readAll(@CurrentUser('id') userId: string) {
    await this.notifications.markAllRead(userId);
    return { ok: true };
  }
}
