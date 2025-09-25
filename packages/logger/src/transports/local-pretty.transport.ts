// Custom pretty formatter for local development that doesn't use worker threads
export const createLocalPrettyTransport = () => {
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
      const level = levelString.toUpperCase().padEnd(5);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
      const msg = log.msg || '';

      // Color codes for terminal output
      const colors = {
        reset: '\x1b[0m',
        gray: '\x1b[90m',
        blue: '\x1b[34m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        bold: '\x1b[1m',
      };

      const levelColors: Record<string, string> = {
        trace: colors.gray,
        debug: colors.blue,
        info: colors.green,
        warn: colors.yellow,
        error: colors.red,
        fatal: colors.bold + colors.red,
      };

      const color = levelColors[levelString] || colors.reset;
      const coloredLevel = color + level + colors.reset;
      const coloredTimestamp = colors.gray + timestamp + colors.reset;

      // Use process.stdout.write for better control and to avoid console.log truncation

      const output = `${coloredTimestamp} ${coloredLevel} ${msg}\n`;
      process.stdout.write(output);

      // Handle error stack trace if err attribute exists
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (log.err?.stack) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const stackLines = log.err.stack.split('\n');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const coloredStackLines = stackLines.map(
          (line: string) => `${colors.red}${line}${colors.reset}`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const stackOutput = `${coloredStackLines.join('\n')}\n`;
        process.stdout.write(stackOutput);
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

        // Format context data with gray color on each line
        const jsonString = JSON.stringify(contextData, null, 2);
        const lines = jsonString.split('\n');
        const coloredLines = lines.map((line) => `${colors.gray}${line}${colors.reset}`);
        const contextOutput = `${colors.gray}  └─ ${coloredLines.join('\n')}\n`;
        process.stdout.write(contextOutput);
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
