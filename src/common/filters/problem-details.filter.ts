import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/domain.error';

const PROBLEM_BASE_URL = 'https://api.reservations.local/errors';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  code: string;
  requestId: string;
  [key: string]: unknown;
}

/**
 * Single translation point from thrown values to RFC 7807 responses.
 *
 * Everything the client sees comes through here, so the wire format cannot
 * drift between endpoints and the domain never imports HTTP types.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    const problem = this.toProblem(exception, request, requestId);

    // 5xx is our bug and needs the stack; 4xx is the client's and does not.
    if (problem.status >= 500) {
      this.logger.error({ requestId, path: request.url, err: exception }, 'Unhandled exception');
    } else {
      this.logger.debug({ requestId, path: request.url, code: problem.code }, problem.title);
    }

    response
      .status(problem.status)
      .type('application/problem+json')
      .setHeader('X-Request-Id', requestId)
      .json(problem);
  }

  private toProblem(exception: unknown, request: Request, requestId: string): ProblemDetails {
    const base = { instance: request.url, requestId };

    // Domain errors carry their own status, code and context.
    if (exception instanceof DomainError) {
      return {
        ...base,
        type: `${PROBLEM_BASE_URL}/${toKebab(exception.code)}`,
        title: exception.message,
        status: exception.status,
        code: exception.code,
        ...exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // ValidationPipe returns { message: string[] }: surface the list as
      // `errors` instead of flattening it into an unreadable sentence.
      const validationMessages =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? payload.message
          : undefined;

      return {
        ...base,
        type: `${PROBLEM_BASE_URL}/${toKebab(HttpStatus[status] ?? 'error')}`,
        title: exception.message,
        status,
        code: HttpStatus[status] ?? 'ERROR',
        ...(Array.isArray(validationMessages) ? { errors: validationMessages } : {}),
      };
    }

    // Anything else is a bug. Never leak the message to the client.
    return {
      ...base,
      type: `${PROBLEM_BASE_URL}/internal-server-error`,
      title: 'Se produjo un error inesperado',
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
    };
  }
}

function toKebab(value: string): string {
  return value.toLowerCase().replace(/_/g, '-');
}
