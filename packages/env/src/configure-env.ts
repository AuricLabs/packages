import dotenv, { DotenvConfigOptions } from 'dotenv';

import { resetEnvironment } from './environment';

export const configureEnv = (options?: DotenvConfigOptions) => {
  dotenv.config(options);
  resetEnvironment();
};
