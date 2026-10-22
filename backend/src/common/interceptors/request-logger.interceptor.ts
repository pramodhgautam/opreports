import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Request logging that intentionally logs only method, path, status and
 * duration. Headers (including `Authorization`) and bodies are never logged,
 * so bearer tokens can never leak into logs.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const start = Date.now();
    const method = request.method;
    const url = request.originalUrl ?? request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          this.logger.log(`${method} ${url} ${response.statusCode} +${Date.now() - start}ms`);
        },
        error: (err: unknown) => {
          const response = context.switchToHttp().getResponse<Response>();
          const status = (err as { status?: number })?.status ?? response.statusCode;
          this.logger.warn(`${method} ${url} ${status} +${Date.now() - start}ms`);
        },
      }),
    );
  }
}
