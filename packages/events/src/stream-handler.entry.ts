import { createStreamHandler } from './stream-handler';

export const handler = createStreamHandler({
  busName: process.env.EVENT_BUS_NAME,
  queueUrls: JSON.parse(process.env.QUEUE_URL_LIST ?? '[]') as string[],
});
