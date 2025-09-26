import { Writable } from 'stream';

import { getEnvironment } from '@auriclabs/env';
import axios from 'axios';
import pino from 'pino';
import { LambdaContext } from 'pino-lambda';

const getSlackMessage = ({
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
    text: '⚠️ Error Alert',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Error Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Environment:*\n${env}`,
          },
          {
            type: 'mrkdwn',
            text: `*Request ID:*\n${requestId ?? 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Correlation ID:*\n${correlationId ?? 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n${new Date(time).toISOString()} (UTC)`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Message:*\n${log}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n\`\`\`\n${stack || 'No stack trace available'}\n\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Logs Dashboard',
              emoji: true,
            },
            url: 'https://your-log-dashboard-url.com', // Replace with your actual logs dashboard URL
            action_id: 'view_logs',
          },
        ],
      },
    ],
  };
};

export const slackDestination = (
  /* istanbul ignore next */
  options: {
    slackWebhookUrl: string;
    getContext?: () => LambdaContext;
  },
): pino.StreamEntry => {
  const writeable = new Writable({
    defaultEncoding: 'utf8',
    write(chunk: string, _encoding, callback) {
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
        const slackMessage = getSlackMessage({
          env: getEnvironment(),
          time,
          log: errMessage,
          stack: errStack,
          requestId: context.awsRequestId,
          correlationId: context['x-correlation-id'] as string,
        });

        axios
          .post(options.slackWebhookUrl, slackMessage, {
            headers: { 'content-type': 'application/json' },
          })
          .catch(() => {
            console.error('Failed to send error to Slack');
          })
          .finally(() => {
            callback();
          });
      } else {
        callback();
      }
    },
  });

  return {
    level: 'error',
    stream: writeable,
  };
};
