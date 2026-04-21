import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface ApiResponse<T> {
  statusCode: number;
  data?: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  private readonly logger = new Logger(TransformInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        this.logger.log(
          `${method} ${url} - ${response.statusCode} - ${Date.now() - now}ms`,
        );
      }),
      map((data) => {
        // Don't transform if it's already in our response format
        if (data && typeof data === 'object' && 'statusCode' in data) {
          return data;
        }

        const response: ApiResponse<T> = {
          statusCode: context.switchToHttp().getResponse().statusCode,
          timestamp: new Date().toISOString(),
        };

        // For auth responses with access_token, keep the original structure
        if (data && typeof data === 'object' && 'access_token' in data) {
          return data;
        }

        // For other objects with message
        if (data && typeof data === 'object' && 'message' in data) {
          response.message = (data as Record<string, unknown>)
            .message as string;
          response.data = data as T;
        } else {
          response.data = data;
        }

        return response;
      }),
    );
  }
}
