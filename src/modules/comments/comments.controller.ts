import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CurrentUser, AuthUser } from '../../common/decorators';
import { CreateCommentDto } from './dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('products/:productId/comments')
  list(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.list(productId, user);
  }

  @Post('products/:productId/comments')
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.create(productId, dto, user);
  }

  @Delete('comments/:id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.comments.remove(id, user);
    return { ok: true };
  }
}
