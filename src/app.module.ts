import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { validateEnv, type Env } from './config/env.validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Kills the process at boot with a readable message when a variable is
      // missing or malformed, instead of failing on the first request.
      validate: validateEnv,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          // One id per request, echoed in every log line and in every
          // problem+json body, so a user-reported error is greppable.
          genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
          redact: ['req.headers.cookie', 'req.headers.authorization'],
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),
        autoLoadEntities: true,
        // Never true. The schema belongs to the migrations: synchronize cannot
        // express the generated `period` column or the EXCLUDE constraint, and
        // would drop them.
        synchronize: false,
        migrationsRun: false,
      }),
    }),

    HealthModule,
  ],
})
export class AppModule {}
