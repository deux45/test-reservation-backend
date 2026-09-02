import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * The OpenAPI document is not just documentation: it is the source of the web
 * client's TypeScript types. If it degrades, the client stops compiling.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Shared Resource Booking API')
    .setDescription(
      [
        'Booking API for shared resources.',
        '',
        '**Central rule:** two `CONFIRMED` reservations never overlap on the same resource.',
        'Intervals are half-open `[start, end)`, so 10:00–11:00 and 11:00–12:00 are',
        'contiguous and both valid.',
        '',
        'Errors follow RFC 7807 (`application/problem+json`).',
      ].join('\n'),
    )
    .setVersion(process.env.npm_package_version ?? '0.0.0')
    .addServer('http://localhost:3000', 'Local')

    // Better Auth authenticates with a session cookie, not a bearer token.
    // With addBearerAuth the "Authorize" button in Swagger UI does nothing.
    .addCookieAuth('better-auth.session_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'better-auth.session_token',
      description: 'Session cookie issued by POST /api/auth/sign-in/email',
    })

    .addTag('Health', 'Liveness and readiness')
    .addTag('Resource types', 'Families of bookable resources')
    .addTag('Resources', 'Create, list, update and deactivate bookable resources')
    .addTag('Availability', 'Free slots for a resource within a range')
    .addTag('Reservations', 'Create, list, reschedule and cancel reservations')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app), {
    // Consumed by openapi-typescript in the web repo.
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
