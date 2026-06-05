import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  // Global /api prefix
  app.setGlobalPrefix('api');

  // CORS for the Next.js client
  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: true,
  });

  // Global validation — strips unknown props, transforms payloads to DTO types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI
  const swaggerCfg = new DocumentBuilder()
    .setTitle('Foundry-Hub API')
    .setDescription('Interior Design Project Management Platform — REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Foundry-Hub API ready at http://localhost:${port}/api`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
