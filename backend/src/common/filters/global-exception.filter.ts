import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(`Exception caught: ${JSON.stringify(exception)}`);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = (exception as HttpException).getStatus();
      const exceptionResponse = (exception as HttpException).getResponse();

      this.logger.error(
        `HttpException: ${status} - ${JSON.stringify(exceptionResponse)}`,
      );

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || (exception as Error).message;
        if (Array.isArray(resp.message)) {
          errors = resp.message;
          message = message || 'Validation error';
        }
      } else {
        message = (exception as Error).message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      message = this.handlePrismaError(exception);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
    } else if (exception instanceof Error) {
      message = exception.message;

      this.logger.error(`Error exception: ${message}`);

      if (exception.name === 'TimeoutError' || message.includes('Timed out')) {
        status = HttpStatus.GATEWAY_TIMEOUT;
        message = 'Request processing timed out. Please try again or contact support if the issue persists.';
      } else if (message.includes('Unique constraint')) {
        status = HttpStatus.CONFLICT;
        message = 'Resource already exists';
      } else if (message.includes('Foreign key constraint')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference to related resource';
      } else if (message.includes('Not found')) {
        status = HttpStatus.NOT_FOUND;
      }
    }

    this.logger.error(
      `${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    };

    if (errors) {
      errorResponse.errors = errors;
    }

    try {
      if (!response.headersSent) {
        response.status(status).json(errorResponse);
      } else {
        console.error('[GlobalExceptionFilter] headers already sent, cannot send error response');
      }
    } catch (sendErr: any) {
      console.error('[GlobalExceptionFilter] failed to send error response:', sendErr?.message || sendErr);
    }
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    switch (exception.code) {
      case 'P2002':
        return 'A record with this value already exists';
      case 'P2025':
        return 'Record not found';
      case 'P2003':
        return 'Invalid reference to related resource';
      case 'P2014':
        return 'The change would violate a required relation';
      default:
        return 'Database operation failed';
    }
  }
}
