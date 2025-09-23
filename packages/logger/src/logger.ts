import { getEnvironment } from '@auriclabs/env';
import pino from 'pino';

import { createStreams, CreateStreamsConfig } from './create-streams';
import { mergeFlexibleArgsHook } from './hooks';
import { resolveLogLevel } from './resolve-log-level';
import { requestSerializer, responseSerializer } from './serializers';

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
