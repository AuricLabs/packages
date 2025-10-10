import { getEnvironment } from '@auriclabs/env';
import pino from 'pino';

import { createStreams, CreateStreamsConfig } from './create-streams';
import { mergeFlexibleArgsHook } from './hooks';
import { resolveLogLevel } from './resolve-log-level';
import { requestSerializer, responseSerializer } from './serializers';
import { ComponentColor } from './transports';

export type Logger = pino.Logger;

export let logger: Logger;

configureLogger();

export function configureLogger(config?: CreateStreamsConfig) {
  logger = pino(
    {
      level: resolveLogLevel(),
      base: {
        get environment() {
          return getEnvironment();
        },
      },
      // Use pino's standard serializers
      serializers: {
        ...pino.stdSerializers,
        req: requestSerializer,
        res: responseSerializer,
      },
      // Standard pino configuration
      messageKey: 'msg',
      timestamp: pino.stdTimeFunctions.isoTime,
      // Use the flexible args hook
      hooks: {
        logMethod: mergeFlexibleArgsHook,
      },
    },
    pino.multistream(createStreams(config)),
  );
}

/**
 * Creates a child logger with a component name that will be displayed in logs.
 *
 * @param component - The component name to display in logs (e.g., 'PricingService', 'UserController')
 * @param color - Optional color for the component name in logs
 * @returns A child logger instance with the component bound
 *
 * @example
 * ```typescript
 * // Basic usage (no color)
 * const pricingLogger = createLogger('PricingService');
 * pricingLogger.info('Calculating price'); // [PricingService] Calculating price
 *
 * // With color
 * const userLogger = createLogger('UserService', 'cyan');
 * userLogger.info('User created'); // [UserService] User created (cyan colored)
 *
 * // Different colors for different components
 * const orderLogger = createLogger('OrderService', 'brightGreen');
 * const paymentLogger = createLogger('PaymentService', 'magenta');
 * ```
 */
export function createLogger(
  component: string,
  additionalData?: Record<string, unknown> & { componentColor?: ComponentColor },
): Logger {
  return logger.child({ ...additionalData, component });
}
