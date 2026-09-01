import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { setupSwagger } from './config/swagger.config';
import { type Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Better Auth reads the raw request body itself. With Nest's body parser
    // active the stream is already consumed and every auth route fails.
    bodyParser: false,
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);

  // credentials:true is what lets the session cookie cross the origin
  // boundary between the SPA and this API.
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
  });

  // Auth routes are mounted by the provider under /api/auth and must not be
  // prefixed; /health stays unprefixed so probes have a stable URL.
  // `{*path}` is the path-to-regexp v8 syntax Express 5 requires; the old
  // `(.*)` form only survives via a deprecation shim that logs on every boot.
  app.setGlobalPrefix('api/v1', { exclude: ['api/auth/{*path}', 'health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Rejects unknown properties instead of stripping them. Also mitigates
      // class-transformer having had no release since 2021: nothing that is
      // not declared in a DTO ever reaches the domain.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  setupSwagger(app);

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
