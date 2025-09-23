import { isLocal } from '@auriclabs/env';
import pino, { Level } from 'pino';
import { GlobalContextStorageProvider, pinoLambdaDestination } from 'pino-lambda';

import {
  createBrowserTransport,
  createLocalPrettyTransport,
  microsoftTeamsDestination,
  slackDestination,
} from './transports';

export interface CreateStreamsConfig {
  microsoftTeamsWebhookUrl?: string;
  slackWebhookUrl?: string;
}

// Create different stream configurations based on environment
export const createStreams = (config?: CreateStreamsConfig) => {
  const streams: (pino.DestinationStream | pino.StreamEntry)[] = [];
  if (isLocal()) {
    // Local development: use pretty formatting
    streams.push({
      // @ts-expect-error - pino.Level does not support silent
      level: 0 as Level,
      stream: createLocalPrettyTransport(),
    });
  } else {
    if (typeof process !== 'undefined') {
      streams.push(pinoLambdaDestination());
    } else {
      // Browser environment: use browser transport
      streams.push({
        // @ts-expect-error - pino.Level does not support silent
        level: 0 as Level,
        stream: createBrowserTransport(),
      });
    }
  }

  if (config?.microsoftTeamsWebhookUrl) {
    // Add Microsoft Teams integration if configured
    streams.push(
      microsoftTeamsDestination({
        microsoftTeamsWebhookUrl: config.microsoftTeamsWebhookUrl,
        getContext: () => {
          return GlobalContextStorageProvider.getContext();
        },
      }),
    );
  }

  if (config?.slackWebhookUrl) {
    streams.push(slackDestination({ slackWebhookUrl: config.slackWebhookUrl }));
  }

  return streams;
};
