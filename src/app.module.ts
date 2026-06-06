import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration, { AppConfig } from './config/configuration';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Infra modules
import { RedisModule } from './modules/redis/redis.module';
import { StorageModule } from './modules/storage/storage.module';
import { MailModule } from './modules/mail/mail.module';

// Domain modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { ProductsModule } from './modules/products/products.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ImportModule } from './modules/import/import.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { InsightsModule } from './modules/insights/insights.module';

// Seed
import { SeedService } from './database/seed.service';
import { User } from './modules/users/user.entity';
import { Project } from './modules/projects/project.entity';
import { Room } from './modules/rooms/room.entity';
import { Schedule } from './modules/schedules/schedule.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const db = config.get('database', { infer: true });
        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.user,
          password: db.password,
          database: db.name,
          synchronize: db.synchronize,
          logging: db.logging,
          autoLoadEntities: true,
        };
      },
    }),

    // BullMQ (Redis-backed queues)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const redis = config.get('redis', { infer: true });
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
        };
      },
    }),

    // Rate limiting (per-IP)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const t = config.get('throttle', { infer: true });
        return [{ ttl: t.ttl * 1000, limit: t.limit }];
      },
    }),

    // Entities needed by the seeder
    TypeOrmModule.forFeature([User, Project, Room, Schedule]),

    // Infra
    RedisModule,
    StorageModule,
    MailModule,

    // Domain
    AuthModule,
    UsersModule,
    ProjectsModule,
    RoomsModule,
    ProductsModule,
    SchedulesModule,
    CommentsModule,
    NotificationsModule,
    ImportModule,
    DashboardModule,
    VendorsModule,
    PurchaseOrdersModule,
    InsightsModule,
  ],
  controllers: [AppController],
  providers: [
    SeedService,
    // Global guards run in registration order: rate-limit → auth → roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
