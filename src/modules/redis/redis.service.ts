import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/** Small JSON cache + key helpers built on ioredis. */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`cache get failed for ${key}: ${err}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds) await this.client.set(key, raw, 'EX', ttlSeconds);
      else await this.client.set(key, raw);
    } catch (err) {
      this.logger.warn(`cache set failed for ${key}: ${err}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  /** Cache-aside helper. */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
