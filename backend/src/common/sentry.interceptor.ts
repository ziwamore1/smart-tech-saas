import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as Sentry from '@sentry/node';
import { isSentryEnabled } from './sentry.config';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        error: (error: Error) => {
          if (isSentryEnabled()) {
            Sentry.withScope((scope) => {
              scope.setTag('http_method', method);
              scope.setTag('http_url', url);
              scope.setTag('handler', context.getClass()?.name);
              scope.setExtra('body', request.body);
              scope.setExtra('params', request.params);
              scope.setExtra('query', request.query);
              Sentry.captureException(error);
            });
          }
        },
      }),
    );
  }
}
