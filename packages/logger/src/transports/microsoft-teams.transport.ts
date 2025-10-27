import { getEnvironment } from '@auriclabs/env';
import axios from 'axios';
import pino from 'pino';
import { LambdaContext } from 'pino-lambda';

const getAdpativeCard = ({
  env,
  time,
  log,
  stack,
  requestId,
  correlationId,
}: {
  env: string;
  time: number;
  log: string;
  stack: string;
  requestId?: string;
  correlationId?: string;
}) => {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'Container',
              style: 'emphasis',
              items: [
                {
                  type: 'TextBlock',
                  text: '⚠️ Error Alert',
                  weight: 'bolder',
                  size: 'large',
                  color: 'attention',
                  wrap: true,
                },
              ],
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'Environment',
                  value: env,
                },
                {
                  title: 'Request ID',
                  value: requestId,
                },
                {
                  title: 'Correlation ID',
                  value: correlationId,
                },
                {
                  title: 'Timestamp',
                  value: `${new Date(time).toISOString()} (UTC)`,
                },
              ],
            },
            {
              type: 'Container',
              style: 'warning',
              items: [
                {
                  type: 'TextBlock',
                  text: 'Error Message',
                  weight: 'bolder',
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  text: log,
                  wrap: true,
                },
              ],
            },
            {
              type: 'Container',
              items: [
                {
                  type: 'TextBlock',
                  text: 'Stack Trace',
                  weight: 'bolder',
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  text: '```\n' + (stack || 'No stack trace available') + '\n```',
                  wrap: true,
                  fontType: 'monospace',
                },
              ],
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View Logs Dashboard',
              url: 'https://your-log-dashboard-url.com', // Replace with your actual logs dashboard URL
            },
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.5',
          msteams: {
            width: 'full',
          },
        },
      },
    ],
  };
};

export const microsoftTeamsDestination = (
  /* istanbul ignore next */
  options: {
    microsoftTeamsWebhookUrl: string;
    getContext?: () => LambdaContext;
  },
): pino.StreamEntry => {
  // Create a web-compatible stream that works in both Node.js and browser environments
  const stream = {
    write(chunk: string) {
      try {
        const data = JSON.parse(chunk) as Record<string, unknown>;
        // implementation detail leaking. Oh well.
        const context = (options.getContext?.() ?? {}) as LambdaContext;

        const { time, err, error } = data as {
          time: number;
          level: string;
          msg: string;
          err?: Record<string, unknown>;
          error?: Record<string, unknown>;
          stack: string;
          [key: string]: unknown;
        };

        const { message: errMessage, stack: errStack } = (err ?? error ?? {}) as {
          message: string;
          stack: string;
        };

        if (errMessage) {
          const adaptiveCard = getAdpativeCard({
            env: getEnvironment(),
            time,
            log: errMessage,
            stack: errStack,
            requestId: context.awsRequestId,
            correlationId: context['x-correlation-id'] as string,
          });

          axios
            .post(options.microsoftTeamsWebhookUrl, adaptiveCard, {
              headers: { 'content-type': 'application/json' },
            })
            .catch(() => {
              console.error('Failed to send error to Microsoft Teams');
            });
        }
      } catch (error) {
        console.error('Error processing Microsoft Teams log:', error);
      }
    },
  };

  return {
    level: 'error',
    stream,
  };
};
