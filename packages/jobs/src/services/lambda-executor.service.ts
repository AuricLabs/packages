import { logger } from '@auriclabs/logger';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

import { JobResponse } from '../types';

const lambdaClient = new LambdaClient();

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const fnMap = new Map<string, string>(JSON.parse(process.env.LAMBDA_FUNCTION_LIST ?? '[]'));

export interface LambdaExecutorServiceInstance {
  getFunctionName(fn: string): string;
  trigger(jobId: string, fn: string, data: unknown): Promise<JobResponse | null>;
}

export function createLambdaExecutorService(): LambdaExecutorServiceInstance {
  return {
    getFunctionName(fn: string) {
      const functionName = fnMap.get(fn);
      if (!functionName) {
        throw new Error(`Lambda function name not found for '${fn}'`);
      }
      return functionName;
    },

    async trigger(jobId: string, fn: string, data: unknown): Promise<JobResponse | null> {
      logger.info({ jobId, functionName: fn }, `Invoking lambda function for job ${jobId}`);

      if (!fn) {
        throw new Error(`Job ${jobId} does not have a function name specified`);
      }

      try {
        const command = new InvokeCommand({
          FunctionName: this.getFunctionName(fn),
          Payload: JSON.stringify(data),
        });

        const response = await lambdaClient.send(command);

        if (response.FunctionError) {
          throw new Error(`Lambda function error: ${response.FunctionError}`);
        }

        const payload =
          response.Payload && response.Payload.length > 0
            ? (JSON.parse(new TextDecoder().decode(response.Payload)) as JobResponse)
            : null;

        logger.info({ jobId, payload }, `Lambda function completed for job ${jobId}`);

        return payload;
      } catch (error) {
        logger.error({ err: error, jobId }, `Failed to invoke lambda function for job ${jobId}`);
        throw error;
      }
    },
  };
}
