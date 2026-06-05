/**
 * Standalone seed runner: `npm run seed`.
 * Boots a minimal Nest application context and triggers SeedService.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function run() {
  const logger = new Logger('SeedCLI');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    // onApplicationBootstrap already runs on init when SEED_ON_BOOT=true;
    // call explicitly so the CLI works regardless of that flag.
    await app.get(SeedService).seed();
    logger.log('Seed complete.');
  } catch (err) {
    logger.error(`Seed failed: ${err}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();
