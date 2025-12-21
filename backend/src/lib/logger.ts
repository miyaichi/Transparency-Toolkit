export type LogSeverity =
  | 'DEFAULT'
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'ALERT'
  | 'EMERGENCY';

export interface LogEntry {
  severity: LogSeverity;
  message: string;
  [key: string]: any;
}

/**
 * Structured Logger for Google Cloud Logging
 * Outputs logs in JSON format to stdout/stderr
 */
class Logger {
  private write(severity: LogSeverity, message: string, payload: Record<string, any> = {}) {
    // In development, pretty print for readability if explicit dev flag is set
    // Otherwise default to JSON even in local to simulate prod behavior often
    const entry: LogEntry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    const json = JSON.stringify(entry);

    if (severity === 'ERROR' || severity === 'CRITICAL' || severity === 'ALERT' || severity === 'EMERGENCY') {
      console.error(json);
    } else {
      console.log(json);
    }
  }

  debug(message: string, payload: Record<string, any> = {}) {
    this.write('DEBUG', message, payload);
  }

  info(message: string, payload: Record<string, any> = {}) {
    this.write('INFO', message, payload);
  }

  notice(message: string, payload: Record<string, any> = {}) {
    this.write('NOTICE', message, payload);
  }

  warn(message: string, payload: Record<string, any> = {}) {
    this.write('WARNING', message, payload);
  }

  error(message: string, payload: Record<string, any> = {}) {
    // Handle Error objects specially to extract stack trace
    if (payload.error instanceof Error) {
      payload.stack = payload.error.stack;
      payload.error = payload.error.message;
    }
    this.write('ERROR', message, payload);
  }

  critical(message: string, payload: Record<string, any> = {}) {
    this.write('CRITICAL', message, payload);
  }
}

export const logger = new Logger();
