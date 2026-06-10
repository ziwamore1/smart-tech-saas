import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { isSentryEnabled } from './sentry.config';

@Catch()
export class SentryFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (isSentryEnabled()) {
      if (exception instanceof HttpException) {
        const status = (exception as HttpException).getStatus();
        if (status >= 500) {
          Sentry.captureException(exception, {
            tags: { httpStatus: status.toString() },
            extra: { exceptionName: (exception as Error).name, message: (exception as Error).message },
          });
        }
      } else {
        Sentry.captureException(exception);
      }
    }
    super.catch(exception, host);
  }
}
