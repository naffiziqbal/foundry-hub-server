import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  /** Includes the (normally hidden) passwordHash — used by auth only. */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    company?: string;
  }): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async update(id: string, patch: Partial<User>): Promise<User> {
    await this.repo.update({ id }, patch);
    return this.findById(id);
  }

  /** Designers can assign any client account to their projects. */
  listClients(): Promise<User[]> {
    return this.repo.find({
      where: { role: UserRole.CLIENT },
      order: { name: 'ASC' },
    });
  }

  /** Lookup including reset-token columns. */
  findWithResetToken(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect(['u.resetTokenHash', 'u.resetTokenExpires'])
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
  }
}
