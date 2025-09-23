import { constantCase } from 'change-case';

export interface OutputsToEnvOptions {
  prefix?: string;
  suffix?: string;
  transform?: (input: string) => string;
}

export const outputsToEnv = (
  outputs: Record<string, $util.Output<string | undefined> | string | undefined>,
  { prefix = '', suffix = '', transform = constantCase }: OutputsToEnvOptions = {},
): Record<string, string | $util.Input<string>> => {
  return Object.fromEntries(
    Object.entries(outputs)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        return [`${prefix}${transform(key)}${suffix}`, value as string];
      }),
  );
};
