import { Injectable, ConsoleLogger, LogLevel } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProductionLogger extends ConsoleLogger {
  private logDir: string;
  private logFile: string;
  private errorFile: string;

  constructor(context?: string) {
    super(context);
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    this.errorFile = path.join(this.logDir, `error-${new Date().toISOString().split('T')[0]}.log`);

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.writeToFile(this.logFile, 'LOG', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    super.error(message, trace, context);
    this.writeToFile(this.errorFile, 'ERROR', message, context, trace);
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.writeToFile(this.logFile, 'WARN', message, context);
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      super.debug(message, context);
    }
    this.writeToFile(this.logFile, 'DEBUG', message, context);
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      super.verbose(message, context);
    }
  }

  private writeToFile(
    filePath: string,
    level: string,
    message: any,
    context?: string,
    trace?: string,
  ) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        context: context || 'Application',
        message: typeof message === 'string' ? message : JSON.stringify(message),
        ...(trace ? { trace } : {}),
        pid: process.pid,
      };

      fs.appendFileSync(filePath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      // Silently fail if logging to file fails
    }
  }

  static getLogLevels(): LogLevel[] {
    const env = process.env.NODE_ENV || 'development';

    if (env === 'production') {
      return ['error'];
    }

    return ['error', 'warn', 'log', 'debug', 'verbose'];
  }
}
