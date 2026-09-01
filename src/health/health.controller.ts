import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';

@ApiTags('Health')
@Public() // Probes and the Docker HEALTHCHECK have no session to present.
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
  ) {}

  /**
   * Liveness and readiness in one endpoint.
   *
   * The database check is what makes this readiness rather than liveness: an
   * API that cannot reach PostgreSQL cannot serve a single useful request, so
   * it should not receive traffic.
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Estado del servicio y de sus dependencias' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.pingCheck('database', { timeout: 1500 })]);
  }
}
