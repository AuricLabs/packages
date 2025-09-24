// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArgsSerializer<T extends (...args: any[]) => any> = (args: Parameters<T>) => string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultArgsSerializer<T extends (...args: any[]) => any>(
  args: Parameters<T>,
): string {
  return JSON.stringify(args);
}
