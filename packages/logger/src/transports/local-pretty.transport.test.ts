import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ComponentColor, createLocalPrettyTransport } from './local-pretty.transport';

describe('createLocalPrettyTransport', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let transport: ReturnType<typeof createLocalPrettyTransport>;

  beforeEach(() => {
    // @ts-expect-error test for process.stdout
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    transport = createLocalPrettyTransport();
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  describe('component name rendering', () => {
    it('should display component name in brackets', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
      };

      transport.write(JSON.stringify(logEntry));

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('[PricingService]');
      expect(output).toContain('test message');
    });

    it('should display component name between level and message', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'UserService',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      // Should be: timestamp LEVEL [Component] message
      expect(output).toMatch(/INFO.*\[UserService\].*test message/);
    });

    it('should not display component brackets when component is not present', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      // Should not contain component brackets (but may contain color code brackets)
      expect(output).not.toMatch(/\[[A-Za-z]/); // No brackets followed by letters (component pattern)
      expect(output).toContain('test message');
    });

    it('should handle empty component name', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: '',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('test message');
    });

    it('should handle various component name formats', () => {
      const components = [
        'UserService',
        'user-service',
        'user_service',
        'API.Users.Controller',
        'DB',
      ];

      components.forEach((component) => {
        stdoutWriteSpy.mockClear();
        const logEntry = {
          time: new Date().toISOString(),
          level: 30,
          msg: 'test',
          component,
        };

        transport.write(JSON.stringify(logEntry));

        const output = stdoutWriteSpy.mock.calls[0][0] as string;
        expect(output).toContain(`[${component}]`);
      });
    });
  });

  describe('component color rendering', () => {
    it('should colorize component name when color is provided', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
        componentColor: 'cyan',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      // Cyan color code is \x1b[36m
      expect(output).toContain('\x1b[36m[PricingService]\x1b[0m');
    });

    it('should not colorize component name when color is not provided', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      // Should contain the component without color codes before it
      expect(output).toContain('[PricingService]');
      // But not the cyan color code
      expect(output).not.toContain('\x1b[36m[PricingService]');
    });

    it('should support cyan color', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test',
        component: 'Test',
        componentColor: 'cyan',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('\x1b[36m'); // cyan
    });

    it('should support magenta color', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test',
        component: 'Test',
        componentColor: 'magenta',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('\x1b[35m'); // magenta
    });

    it('should support blue color', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test',
        component: 'Test',
        componentColor: 'blue',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('\x1b[34m'); // blue
    });

    it('should support green color', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test',
        component: 'Test',
        componentColor: 'green',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('\x1b[32m'); // green
    });

    it('should support bright colors', () => {
      const brightColors: { color: ComponentColor; code: string }[] = [
        { color: 'brightBlue', code: '\x1b[94m' },
        { color: 'brightGreen', code: '\x1b[92m' },
        { color: 'brightYellow', code: '\x1b[93m' },
        { color: 'brightMagenta', code: '\x1b[95m' },
        { color: 'brightCyan', code: '\x1b[96m' },
      ];

      brightColors.forEach(({ color, code }) => {
        stdoutWriteSpy.mockClear();
        const logEntry = {
          time: new Date().toISOString(),
          level: 30,
          msg: 'test',
          component: 'Test',
          componentColor: color,
        };

        transport.write(JSON.stringify(logEntry));

        const output = stdoutWriteSpy.mock.calls[0][0] as string;
        expect(output).toContain(code);
      });
    });

    it('should handle invalid color gracefully', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
        componentColor: 'invalidColor',
      };

      expect(() => {
        transport.write(JSON.stringify(logEntry));
      }).not.toThrow();

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      // Should display component without color
      expect(output).toContain('[PricingService]');
      expect(output).toContain('test message');
    });

    it('should reset color after component name', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
        componentColor: 'cyan',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      // Should have reset code after the component
      expect(output).toContain('\x1b[36m[PricingService]\x1b[0m');
    });
  });

  describe('component with context properties', () => {
    it('should not include component in context dump', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
        customField: 'customValue',
      };

      transport.write(JSON.stringify(logEntry));

      // Should be called twice: once for main log, once for context
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(2);

      const contextOutput = stdoutWriteSpy.mock.calls[1][0] as string;
      // Context should include customField but not component
      expect(contextOutput).toContain('customField');
      expect(contextOutput).not.toContain('"component"');
    });

    it('should not include componentColor in context dump', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
        componentColor: 'cyan',
        customField: 'customValue',
      };

      transport.write(JSON.stringify(logEntry));

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(2);

      const contextOutput = stdoutWriteSpy.mock.calls[1][0] as string;
      expect(contextOutput).toContain('customField');
      expect(contextOutput).not.toContain('"componentColor"');
    });

    it('should display component with additional context', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'test message',
        component: 'PricingService',
        componentColor: 'cyan',
        userId: '123',
        price: 99.99,
      };

      transport.write(JSON.stringify(logEntry));

      const mainOutput = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(mainOutput).toContain('[PricingService]');
      expect(mainOutput).toContain('test message');

      const contextOutput = stdoutWriteSpy.mock.calls[1][0] as string;
      expect(contextOutput).toContain('userId');
      expect(contextOutput).toContain('123');
      expect(contextOutput).toContain('price');
      expect(contextOutput).toContain('99.99');
    });
  });

  describe('component with different log levels', () => {
    it('should display component with INFO level', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 30,
        msg: 'info message',
        component: 'TestService',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('INFO');
      expect(output).toContain('[TestService]');
    });

    it('should display component with ERROR level', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 50,
        msg: 'error message',
        component: 'TestService',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('ERROR');
      expect(output).toContain('[TestService]');
    });

    it('should display component with WARN level', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 40,
        msg: 'warning message',
        component: 'TestService',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('WARN');
      expect(output).toContain('[TestService]');
    });

    it('should display component with DEBUG level', () => {
      const logEntry = {
        time: new Date().toISOString(),
        level: 20,
        msg: 'debug message',
        component: 'TestService',
      };

      transport.write(JSON.stringify(logEntry));

      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('DEBUG');
      expect(output).toContain('[TestService]');
    });
  });

  describe('component with error stack traces', () => {
    it('should display component with error stack trace', () => {
      const error = new Error('Test error');
      const logEntry = {
        time: new Date().toISOString(),
        level: 50,
        msg: 'error occurred',
        component: 'ErrorService',
        componentColor: 'red',
        err: {
          type: 'Error',
          message: error.message,
          stack: error.stack,
        },
      };

      transport.write(JSON.stringify(logEntry));

      // Should output main log and stack trace
      expect(stdoutWriteSpy).toHaveBeenCalled();

      const mainOutput = stdoutWriteSpy.mock.calls[0][0] as string;
      expect(mainOutput).toContain('[ErrorService]');
      expect(mainOutput).toContain('error occurred');

      // Stack trace should be in second call
      const stackOutput = stdoutWriteSpy.mock.calls[1][0] as string;
      expect(stackOutput).toContain('Error');
      expect(stackOutput).toContain('Test error');
    });
  });
});
