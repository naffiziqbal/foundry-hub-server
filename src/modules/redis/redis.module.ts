import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../../config/configuration';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Global Redis access — exposes a raw ioredis client (used for caching and
 * rate-limit counters) plus a thin RedisService wrapper. BullMQ is configured
 * separately in the import module via @nestjs/bullmq.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const redis = config.get('redis', { infer: true });
        return new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
          maxRetriesPerRequest: null,
          lazyConnect: false,
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
