// Browser-compatible transport that uses console methods with styling
export const createBrowserTransport = () => {
  return {
    write: (obj: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const log = JSON.parse(obj);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const timestamp = new Date(log.time).toLocaleTimeString();

      // Pino uses numeric levels: trace=10, debug=20, info=30, warn=40, error=50, fatal=60
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const levelNumber = log.level;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const levelString = getLevelString(levelNumber);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
      const msg = log.msg || '';

      // Browser console styling
      const styles = {
        timestamp: 'color: #888; font-size: 0.9em;',
        trace: 'color: #888;',
        debug: 'color: #007acc;',
        info: 'color: #28a745;',
        warn: 'color: #ffc107; font-weight: bold;',
        error: 'color: #dc3545; font-weight: bold;',
        fatal: 'color: #dc3545; font-weight: bold; background: #fff5f5;',
        context: 'color: #666; font-style: italic;',
      };

      const levelStyle = styles[levelString as keyof typeof styles] || styles.info;
      const level = levelString.toUpperCase().padEnd(5);

      // Use appropriate console method based on log level
      const consoleMethod = getConsoleMethod(levelString);

      // Format the main log message with styling
      consoleMethod(
        `%c${timestamp} %c${level} %c${String(msg)}`,
        styles.timestamp,
        levelStyle,
        'color: inherit;',
      );

      // Handle error stack trace if err attribute exists
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (log.err?.stack) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const stack = log.err.stack;
        console.error('Stack trace:', stack);
      }

      // Log additional context properties (excluding standard pino properties)
      const standardProps = ['time', 'level', 'msg', 'pid', 'hostname', 'v', 'err', 'environment'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const contextProps = Object.keys(log).filter((key) => !standardProps.includes(key));

      if (contextProps.length > 0) {
        const contextData = contextProps.reduce<Record<string, unknown>>((acc, key) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          acc[key] = log[key];
          return acc;
        }, {});

        // eslint-disable-next-line no-console
        console.groupCollapsed('%cContext', styles.context);
        // eslint-disable-next-line no-console
        console.table(contextData);
        // eslint-disable-next-line no-console
        console.groupEnd();
      }
    },
  };
};

// Helper function to convert numeric log levels to string representations
function getLevelString(level: number): string {
  switch (level) {
    case 10:
      return 'trace';
    case 20:
      return 'debug';
    case 30:
      return 'info';
    case 40:
      return 'warn';
    case 50:
      return 'error';
    case 60:
      return 'fatal';
    default:
      return 'info'; // fallback for unknown levels
  }
}

// Helper function to get appropriate console method based on log level
function getConsoleMethod(levelString: string): typeof console.log {
  switch (levelString) {
    case 'trace':
      // eslint-disable-next-line no-console
      return console.trace;
    case 'debug':
      // eslint-disable-next-line no-console
      return console.debug;
    case 'info':
      // eslint-disable-next-line no-console
      return console.info;
    case 'warn':
      return console.warn;
    case 'error':
    case 'fatal':
      return console.error;
    default:
      // eslint-disable-next-line no-console
      return console.log;
  }
}
