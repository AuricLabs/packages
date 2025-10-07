import { camelCase, upperFirst } from 'lodash-es';

export const sstCase = (str: string) => {
  return upperFirst(camelCase(str));
};
