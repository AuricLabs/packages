import dotenv, { DotenvConfigOptions } from 'dotenv';

import { configureEnvironment, EnvironmentConfig } from './environment';

export interface ConfigureEnvOptions extends Partial<EnvironmentConfig> {
  dotenv?: DotenvConfigOptions;
}

export const configureEnv = ({ dotenv: dotenvOptions, ...options }: ConfigureEnvOptions = {}) => {
  dotenv.config(dotenvOptions);
  configureEnvironment(options);
};
