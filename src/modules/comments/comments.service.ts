import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { Product } from '../products/product.entity';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../../common/decorators';
import {
  CommentVisibility,
  NotificationType,
  UserRole,
} from '../../common/enums';
import { CreateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly repo: Repository<Comment>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getProductOrThrow(productId: string): Promise<Product> {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async list(productId: string, user: AuthUser): Promise<Comment[]> {
    const product = await this.getProductOrThrow(productId);
    await this.projects.assertAccess(product.projectId, user);

    const comments = await this.repo.find({
      where: { productId },
      order: { createdAt: 'ASC' },
    });
    // Clients never see internal comments
    if (user.role === UserRole.CLIENT) {
      return comments.filter((c) => c.visibility === CommentVisibility.CLIENT);
    }
    return comments;
  }

  async create(
    productId: string,
    dto: CreateCommentDto,
    user: AuthUser,
  ): Promise<Comment> {
    const product = await this.getProductOrThrow(productId);
    const project = await this.projects.assertAccess(product.projectId, user);

    // Clients may only post client-visible comments
    const visibility =
      user.role === UserRole.CLIENT
        ? CommentVisibility.CLIENT
        : dto.visibility ?? CommentVisibility.INTERNAL;

    const comment = this.repo.create({
      body: dto.body,
      visibility,
      productId,
      authorId: user.id,
    });
    const saved = await this.repo.save(comment);

    // Notify the counterpart for client-visible comments
    if (visibility === CommentVisibility.CLIENT) {
      const recipientId =
        user.id === project.designerId ? project.clientId : project.designerId;
      if (recipientId) {
        await this.notifications.create({
          userId: recipientId,
          type: NotificationType.COMMENT_ADDED,
          title: 'New comment',
          message: `${user.name} commented on "${product.name}".`,
          data: { productId, projectId: project.id },
        });
      }
    }
    return this.repo.findOneOrFail({ where: { id: saved.id } });
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const comment = await this.repo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    const product = await this.getProductOrThrow(comment.productId);
    await this.projects.assertAccess(product.projectId, user);

    // Only the author or the project designer can delete
    const project = await this.projects.assertAccess(product.projectId, user);
    if (comment.authorId !== user.id && project.designerId !== user.id) {
      throw new ForbiddenException('Cannot delete this comment');
    }
    await this.repo.delete({ id });
  }
}
