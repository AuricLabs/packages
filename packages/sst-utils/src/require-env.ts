export function requireEnv(name: string, defaultValue: string): string;
export function requireEnv(name: string, defaultValue?: string): string | undefined;
export function requireEnv(name: string, defaultValue?: string) {
  const value = process.env[name];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value ?? defaultValue;
}
