import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationType } from '../../common/enums';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, any>;
  email?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly mail: MailService,
    private readonly users: UsersService,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification = this.repo.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? {},
    });
    const saved = await this.repo.save(notification);

    // Optional email hook
    if (input.email) {
      try {
        const user = await this.users.findById(input.userId);
        await this.mail.send({
          to: user.email,
          subject: input.title,
          text: input.message ?? input.title,
        });
      } catch {
        /* non-fatal — in-app notification already persisted */
      }
    }
    return saved;
  }

  list(userId: string, onlyUnread = false): Promise<Notification[]> {
    return this.repo.find({
      where: onlyUnread ? { userId, read: false } : { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo.update({ id, userId }, { read: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ userId, read: false }, { read: true });
  }
}
